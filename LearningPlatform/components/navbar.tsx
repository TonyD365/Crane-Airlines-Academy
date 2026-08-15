import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { auth } from '@/auth';
import { signOut } from '@/auth';
import ThemeToggle from '@/components/theme-toggle';
import { MoodleNavLinks } from '@/components/moodle-nav-links';
import { isStaffRole } from '@/lib/roles';

/** Moodle-style navy top bar for the student area. */
export async function Navbar() {
  const session = await auth();
  const displayName = session?.user?.name ?? null
  const initial = (displayName ?? session?.user?.email ?? 'A')[0]?.toUpperCase()

  return (
    <nav className="fixed inset-x-0 top-0 z-40 bg-[#2b295c] text-white shadow-sm dark:bg-[#1e1c40]">
      <div className="mx-auto flex min-h-[4.25rem] max-w-[90rem] items-center gap-4 px-4 sm:min-h-[4.5rem] sm:px-6">
        {/* Brand */}
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
          <span className="text-lg font-bold tracking-tight text-white sm:text-xl">
            Crane Airlines Academy
          </span>
        </Link>

        {/* Primary nav */}
        {session ? <MoodleNavLinks /> : null}

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {session ? (
            <>
              <span className="text-white">
                <ThemeToggle />
              </span>
              {isStaffRole(session.user?.role) && (
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                >
                  <Link href="/admin/dashboard">Admin</Link>
                </Button>
              )}
              <Link
                href="/profile"
                className="flex min-w-0 items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-white/10"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-base font-semibold text-white ring-1 ring-white/30"
                  aria-hidden
                >
                  {initial}
                </span>
                <span className="hidden max-w-[10rem] truncate text-sm font-medium text-white sm:inline">
                  {displayName ?? 'Account'}
                </span>
              </Link>
              <form
                action={async () => {
                  'use server';
                  await signOut({ redirectTo: '/' });
                }}
              >
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  className="border-white/40 bg-transparent text-white hover:bg-white/15 hover:text-white"
                >
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <>
              <span className="text-white">
                <ThemeToggle />
              </span>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              >
                <Link href="/login">Sign in</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
