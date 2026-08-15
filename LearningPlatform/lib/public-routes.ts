/**
 * Shared public-route allow-lists used by both middleware.ts and auth.ts.
 * Kept in a separate file (no imports) to avoid the circular dependency that
 * would arise if middleware/auth imported these from lib/auth-helpers, which
 * itself imports from @/auth.
 */

/** Exact paths accessible without authentication. */
export const PUBLIC_PATHS = [
  '/',
  '/login',
  // Self-service registration is disabled. The /register page now redirects to
  // /login; it stays public only so that redirect can run without an auth bounce.
  '/register',
  '/admin/login',
  // Legal pages — must be publicly reachable (e.g. for the Roblox OAuth app listing).
  '/privacy',
  '/terms',
  '/api/ping',
  '/api/healthz',
] as const

/** Path prefixes accessible without authentication. */
export const PUBLIC_PATH_PREFIXES = [
  '/api/auth',
  '/auth',
  '/media',
  '/api/media/list',
  '/api/media/serve',
  '/api/subjects',
] as const
