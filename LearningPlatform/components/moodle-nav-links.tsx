'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

type NavLink = { label: string; href: string; match: (path: string) => boolean }

const LINKS: NavLink[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    match: (p) => p === '/dashboard' || p.startsWith('/dashboard/'),
  },
  {
    label: 'My courses',
    href: '/courses',
    match: (p) => p === '/courses' || p.startsWith('/courses/'),
  },
  {
    label: 'Practice',
    href: '/practice',
    match: (p) => p === '/practice' || p.startsWith('/practice/'),
  },
]

/** Moodle-style top nav tabs: white text on the navy bar with an active underline. */
export function MoodleNavLinks() {
  const pathname = usePathname() || ''

  return (
    <nav className="flex items-stretch gap-1 sm:gap-2">
      {LINKS.map((link) => {
        const active = link.match(pathname)
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'relative flex items-center px-2 py-3 text-sm font-medium text-white/80 transition-colors hover:text-white sm:px-3 sm:text-base',
              active && 'text-white',
            )}
          >
            {link.label}
            <span
              aria-hidden
              className={cn(
                'absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-white transition-opacity sm:inset-x-2',
                active ? 'opacity-100' : 'opacity-0',
              )}
            />
          </Link>
        )
      })}
    </nav>
  )
}
