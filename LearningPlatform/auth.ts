import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import type { Role } from '@prisma/client';
import { PUBLIC_PATHS, PUBLIC_PATH_PREFIXES } from '@/lib/public-routes';
import { logActivity, ActivityAction } from '@/lib/activity-log';
import { checkRateLimit } from '@/lib/rate-limit';
import { isTokenRevoked, revokeToken } from '@/lib/token-blocklist';

const loginSchema = z.object({
  // Accounts sign in with their RBX (Roblox) username, not email.
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Trust host: explicit flag (Docker/proxies) or local dev (any port, e.g. 3001).
  trustHost:
    process.env.AUTH_TRUST_HOST === 'true' || process.env.NODE_ENV === 'development',
  
  session: {
    strategy: 'jwt',
    // 8-hour session lifetime — reduces exposure window for stolen tokens
    maxAge: 28800,
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    Credentials({
      credentials: {
        username: { label: 'RBX Username', type: 'text' },
        password: { label: 'Hasło', type: 'password' },
      },
      authorize: async (credentials, request) => {
        try {
          const { username: rawUsername, password } = loginSchema.parse(credentials);
          const username = rawUsername.trim().toLowerCase();

          // Rate-limit: per IP when known; per username when IP is missing (Docker).
          if (request) {
            const rate = await checkRateLimit({
              request,
              key: 'login',
              limit: 5,
              windowMs: 300_000,
              identityFallback: username,
            });
            if (!rate.allowed) {
              throw new Error('Too many login attempts. Please try again later.');
            }
          }

          const user = await prisma.user.findUnique({
            where: { username },
          });

          if (!user || !user.passwordHash) {
            // Avoid user enumeration — log without revealing which condition failed
            logActivity({
              action:       ActivityAction.USER_LOGIN_FAILED,
              actorEmail:   username,
              resourceType: 'user',
            });
            return null;
          }

          const isPasswordValid = await bcrypt.compare(
            password,
            user.passwordHash
          );

          if (!isPasswordValid) {
            logActivity({
              action:       ActivityAction.USER_LOGIN_FAILED,
              actorUserId:  user.id,
              actorEmail:   user.email,
              resourceType: 'user',
              resourceId:   user.id,
            });
            return null;
          }

          logActivity({
            action:       ActivityAction.USER_LOGIN,
            actorUserId:  user.id,
            actorEmail:   user.email,
            resourceType: 'user',
            resourceId:   user.id,
          });

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            isPro: user.isPro,
          };
        } catch (err) {
          // Re-throw rate-limit errors so NextAuth surfaces them to the user
          if (err instanceof Error && err.message.includes('Too many login attempts')) {
            throw err;
          }
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // ── Initial sign-in: embed identity and a unique JTI ───────────────
        // The JTI (JWT ID) is the handle used by the revocation blocklist.
        // It is generated once per session and checked on every subsequent request.
        token.id   = user.id;
        token.jti  = randomUUID();
        token.role = (user as { role?: Role }).role;
        token.isPro = Boolean((user as { isPro?: boolean }).isPro);
        token.roleRefreshedAt = Date.now();
      } else if (token.id) {
        // ── Every subsequent request ───────────────────────────────────────

        // 1. Revocation check: reject tokens that were explicitly invalidated
        //    on sign-out (or by an admin action).
        if (token.jti && await isTokenRevoked(token.jti as string)) {
          // Returning null invalidates the session (Auth.js v5 behaviour).
          return null;
        }

        // 2. Role freshness: re-fetch the user's role from the database every
        //    5 minutes so that privilege changes (e.g. admin → student) take
        //    effect within that window rather than at token expiry.
        const now          = Date.now();
        const lastRefresh  = (token.roleRefreshedAt as number) ?? 0;
        if (now - lastRefresh > 5 * 60 * 1_000) {
          const freshUser = await prisma.user.findUnique({
            where:  { id: token.id as string },
            select: { role: true, isPro: true },
          });
          // If the user record was deleted, invalidate the session immediately.
          if (!freshUser) return null;
          token.role            = freshUser.role;
          token.isPro           = freshUser.isPro;
          token.roleRefreshedAt = now;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id   = token.id   as string;
        session.user.role = token.role as Role;
        session.user.isPro = token.isPro === true;
      }
      return session;
    },
    async authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      
      // Public routes - always allow
      if (
        (PUBLIC_PATHS as readonly string[]).includes(pathname) ||
        PUBLIC_PATH_PREFIXES.some(p => pathname.startsWith(p))
      ) {
        return true;
      }
      
      // Protected routes - require authentication
      if (pathname.startsWith('/admin') || pathname.startsWith('/courses') || pathname.startsWith('/dashboard')) {
        return !!auth?.user;
      }
      
      return true;
    },
  },

  events: {
    /**
     * Sign-out event: add the session's JTI to the revocation blocklist so
     * the token cannot be reused even if it is still within its 8-hour window.
     * The entry is automatically cleaned up after the token's expiry time.
     */
    async signOut(message) {
      const token = 'token' in message ? message.token : null;
      const jti = token?.jti;
      if (jti && typeof jti === 'string') {
        // Determine the token's expiry from the `exp` claim (seconds since epoch)
        // set by Auth.js, or fall back to the configured session maxAge.
        const expiresAt = token.exp
          ? new Date((token.exp as number) * 1_000)
          : new Date(Date.now() + 28_800_000); // 8 hours

        await revokeToken(jti, expiresAt);

        logActivity({
          action:       ActivityAction.USER_LOGOUT,
          actorUserId:  token.id  as string | undefined,
          actorEmail:   token.email as string | undefined,
          resourceType: 'user',
          resourceId:   token.id  as string | undefined,
        });
      }
    },
  },
});
