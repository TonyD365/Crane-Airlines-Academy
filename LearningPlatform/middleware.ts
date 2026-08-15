import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { auth } from '@/auth';
import { PUBLIC_PATHS, PUBLIC_PATH_PREFIXES } from '@/lib/public-routes';
import { isStaffRole } from '@/lib/roles';

// ─── CSP builder ──────────────────────────────────────────────────────────────

/**
 * Build a Content-Security-Policy header value for the given nonce.
 *
 * 'unsafe-inline' is intentionally absent from script-src.
 * Modern browsers ignore 'unsafe-inline' when a nonce is present, so adding
 * the nonce here means only scripts that carry the matching nonce attribute
 * (or are loaded from 'self') can execute.
 *
 * 'unsafe-eval' is kept because Payload CMS and some bundler chunks require it.
 * 'unsafe-inline' remains in style-src because Tailwind CSS emits inline styles.
 */
function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'unsafe-eval'`,
    "style-src 'self' 'unsafe-inline'",
    // Restrict image origins to known storage providers.
    // Use 'https:' only during development or when a custom S3 endpoint is
    // configured that does not match the patterns below.
    "img-src 'self' data: blob: https://t3.storageapi.dev https://*.amazonaws.com https://*.r2.dev https://img.youtube.com https://i.ytimg.com",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}

// ─── Middleware ────────────────────────────────────────────────────────────────

// Export auth middleware with custom logic
export default auth((req) => {
  // Generate a cryptographically random nonce for this request.
  // base64url encoding avoids characters that need quoting inside the CSP string.
  const nonce = randomBytes(16).toString('base64url')
  const csp   = buildCsp(nonce)

  const { nextUrl } = req
  const isLoggedIn  = !!req.auth
  const role        = (req.auth as { user?: { role?: string } } | null)?.user?.role

  // Public routes that don't require authentication
  const isPublicRoute =
    (PUBLIC_PATHS as readonly string[]).includes(nextUrl.pathname) ||
    PUBLIC_PATH_PREFIXES.some(p => nextUrl.pathname.startsWith(p))

  // Helper: attach CSP to any response (redirect or pass-through)
  const withCsp = (res: NextResponse): NextResponse => {
    res.headers.set('Content-Security-Policy', csp)
    return res
  }

  // If not logged in and trying to access protected route
  if (!isLoggedIn && !isPublicRoute) {
    return withCsp(NextResponse.redirect(new URL('/login', nextUrl)))
  }

  // Admin-only routes
  if (nextUrl.pathname.startsWith('/admin')) {
    if (!isLoggedIn) {
      return withCsp(NextResponse.redirect(new URL('/admin/login', nextUrl)))
    }
    if (!isStaffRole(role)) {
      return withCsp(NextResponse.redirect(new URL('/dashboard', nextUrl)))
    }
  }

  // If logged in and trying to access login page, redirect to home
  if (isLoggedIn && (nextUrl.pathname === '/login' || nextUrl.pathname === '/register')) {
    return withCsp(NextResponse.redirect(new URL('/dashboard', nextUrl)))
  }

  if (isLoggedIn && nextUrl.pathname === '/admin/login') {
    return withCsp(NextResponse.redirect(new URL('/admin/dashboard', nextUrl)))
  }

  // Pass-through: forward the nonce to server components via a request header
  // so that layout.tsx can apply it to inline <script nonce={nonce}> tags.
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('x-pathname', nextUrl.pathname)

  return withCsp(
    NextResponse.next({ request: { headers: requestHeaders } })
  )
})

// Configure runtime and matcher
export const config = {
  // Use Node.js runtime instead of Edge for PostgreSQL compatibility
  runtime: 'nodejs',
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     * - api/media/upload (file upload — body must not be consumed by middleware;
     *   the route itself calls requireAdmin() for auth)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/media/upload|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
