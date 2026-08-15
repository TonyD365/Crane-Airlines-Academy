import Link from 'next/link';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { auth } from '@/auth';
import { signOut } from '@/auth';
import ThemeToggle from '@/components/theme-toggle';
import { NavbarBrand } from '@/components/navbar-brand';
import { studentGlassNav } from '@/lib/student-glass-styles';
import { cn } from '@/lib/utils';
import { isStaffRole } from '@/lib/roles';

export async function Navbar() {
  const session = await auth();
  const displayName = session?.user?.name ?? null
  const initial = (displayName ?? session?.user?.email ?? 'A')[0]?.toUpperCase()

  return (
    <nav className={cn('fixed inset-x-0 top-0 z-40', studentGlassNav)}>
      <div className="container mx-auto flex min-h-[4.25rem] items-center justify-between gap-4 px-4 py-3 sm:min-h-[4.5rem] sm:py-4">
        <NavbarBrand />
        
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 md:gap-4">
          {session ? (
            <>
              {/* Order: user → theme → settings → (admin) → sign out */}
              <Link href="/profile" className="flex min-w-0 items-center gap-2.5 rounded-md px-1 py-0.5 hover:bg-black/5 dark:hover:bg-white/10">
                <div
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-base font-semibold backdrop-blur-sm',
                    /* Light: readable on pale glass nav — tint + rim + soft depth (navbar shell unchanged). */
                    'border-slate-400/45 bg-slate-200/75 text-slate-800 shadow-sm ring-1 ring-slate-900/[0.06]',
                    'dark:border-white/20 dark:bg-white/10 dark:text-gray-100 dark:shadow-none dark:ring-0',
                  )}
                  aria-hidden
                >
                  {initial}
                </div>
                <span className="max-w-[10rem] truncate text-base text-slate-800 dark:text-gray-100 sm:max-w-[14rem] md:max-w-none">
                  {displayName ?? 'Account'}
                </span>
              </Link>
              <ThemeToggle />
              <Button asChild variant="ghost" size="icon-xl" aria-label="Settings">
                <Link href="/dashboard/flashcards/settings">
                  <Settings className="size-6" />
                </Link>
              </Button>
              {isStaffRole(session.user?.role) && (
                <Button asChild variant="hero" size="default" className="auth-hero-cta text-base">
                  <Link href="/admin/dashboard">Admin panel</Link>
                </Button>
              )}
              <form
                action={async () => {
                  'use server';
                  await signOut({ redirectTo: '/' });
                }}
              >
                <Button type="submit" variant="hero" size="default" className="auth-hero-cta text-base">
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <>
              <ThemeToggle />
              <Button asChild variant="hero" size="default" className="auth-hero-cta text-base">
                <Link href="/register">Get started</Link>
              </Button>
              <Button asChild variant="hero" size="default" className="auth-hero-cta text-base">
                <Link href="/login">Sign in</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
