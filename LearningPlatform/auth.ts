import NextAuth from 'next-auth';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import type { Role } from '@prisma/client';
import { PUBLIC_PATHS, PUBLIC_PATH_PREFIXES } from '@/lib/public-routes';
import { logActivity, ActivityAction } from '@/lib/activity-log';
import { isTokenRevoked, revokeToken } from '@/lib/token-blocklist';

/**
 * Roblox OpenID Connect provider.
 *
 * Accounts are created by admins only (keyed on the Roblox numeric user id).
 * A person can only sign in if an admin has pre-created a User whose
 * `rbxUserId` matches the `sub` claim returned by Roblox — see the `signIn`
 * and `jwt` callbacks below.
 *
 * Configure a Roblox OAuth app at https://create.roblox.com/dashboard/credentials
 * with redirect URI `<APP_URL>/api/auth/callback/roblox` and set
 * ROBLOX_CLIENT_ID / ROBLOX_CLIENT_SECRET.
 */
const RobloxProvider = {
  id: 'roblox',
  name: 'Roblox',
  type: 'oidc' as const,
  // Must match the `issuer` in Roblox's discovery doc exactly — it has a trailing slash.
  issuer: 'https://apis.roblox.com/oauth/',
  clientId: process.env.ROBLOX_CLIENT_ID,
  clientSecret: process.env.ROBLOX_CLIENT_SECRET,
  authorization: { params: { scope: 'openid profile' } },
  checks: ['pkce', 'state'] as ('pkce' | 'state')[],
};

/** Look up the internal account tied to a Roblox `sub`, or null. */
async function findUserByRbxId(sub: unknown) {
  const rbxUserId = sub == null ? '' : String(sub);
  if (!rbxUserId) return null;
  return prisma.user.findUnique({ where: { rbxUserId } });
}

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
  providers: [RobloxProvider],
  callbacks: {
    /**
     * Gate sign-in: only allow Roblox accounts that an admin has pre-registered.
     */
    async signIn({ account, profile }) {
      if (account?.provider !== 'roblox') return false;
      const user = await findUserByRbxId(profile?.sub);
      if (!user) {
        logActivity({
          action:       ActivityAction.USER_LOGIN_FAILED,
          actorEmail:   profile?.preferred_username ?? (profile?.sub ? String(profile.sub) : undefined),
          resourceType: 'user',
        });
        return false;
      }
      return true;
    },

    async jwt({ token, account, profile }) {
      if (account?.provider === 'roblox' && profile) {
        // ── Initial Roblox sign-in ─────────────────────────────────────────
        const user = await findUserByRbxId(profile.sub);
        if (!user) return null;

        token.id    = user.id;
        token.jti   = randomUUID();
        token.role  = user.role;
        token.isPro = user.isPro;
        // `email` on the session carries the username (identity display); the
        // User table no longer stores an email address.
        token.email = user.username ?? String(profile.sub);
        token.name  = user.name ?? user.username ?? null;
        token.roleRefreshedAt = Date.now();

        logActivity({
          action:       ActivityAction.USER_LOGIN,
          actorUserId:  user.id,
          actorEmail:   user.username ?? undefined,
          resourceType: 'user',
          resourceId:   user.id,
        });
      } else if (token.id) {
        // ── Every subsequent request ───────────────────────────────────────

        // 1. Revocation check: reject tokens that were explicitly invalidated
        //    on sign-out (or by an admin action).
        if (token.jti && await isTokenRevoked(token.jti as string)) {
          return null;
        }

        // 2. Role freshness: re-fetch role/isPro from the database every 5
        //    minutes so privilege changes take effect within that window.
        const now         = Date.now();
        const lastRefresh = (token.roleRefreshedAt as number) ?? 0;
        if (now - lastRefresh > 5 * 60 * 1_000) {
          const freshUser = await prisma.user.findUnique({
            where:  { id: token.id as string },
            select: { role: true, isPro: true, username: true },
          });
          // If the user record was deleted, invalidate the session immediately.
          if (!freshUser) return null;
          token.role            = freshUser.role;
          token.isPro           = freshUser.isPro;
          if (freshUser.username) token.email = freshUser.username;
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
        // `email` carries the RBX username (identity label); there is no email address.
        if (typeof token.email === 'string') session.user.email = token.email;
        if (typeof token.name === 'string') session.user.name = token.name;
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
     */
    async signOut(message) {
      const token = 'token' in message ? message.token : null;
      const jti = token?.jti;
      if (jti && typeof jti === 'string') {
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
