'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, BrainCircuit, GraduationCap, Image, Settings, LayoutDashboard, ChevronLeft, ChevronRight, ClipboardList, Tag, ScrollText, Users, UsersRound, Sparkles, ClipboardCheck } from 'lucide-react'
import { adminGlassSidebar } from '@/lib/student-glass-styles'
import { cn } from '@/lib/utils'
import { isManagerRole } from '@/lib/roles'
import { useEffect, useState } from 'react'

/** `minRole`: 'staff' = any staff (Trainer+); 'manager' = Manager or President. */
const navItems = [
  {
    title: 'Dashboard',
    href: '/admin/dashboard',
    icon: LayoutDashboard,
    minRole: 'manager' as const,
  },
  {
    title: 'Completion',
    href: '/admin/completion',
    icon: ClipboardCheck,
    minRole: 'staff' as const,
  },
  {
    title: 'Lessons',
    href: '/admin/lessons',
    icon: GraduationCap,
    minRole: 'manager' as const,
  },
  {
    title: 'Subjects',
    href: '/admin/subjects',
    icon: BookOpen,
    minRole: 'manager' as const,
  },
  {
    title: 'Tags',
    href: '/admin/tags',
    icon: Tag,
    minRole: 'manager' as const,
  },
  {
    title: 'Tasks',
    href: '/admin/tasks',
    icon: ClipboardList,
    minRole: 'manager' as const,
  },
  {
    title: 'Flashcards',
    href: '/admin/flashcards',
    icon: BrainCircuit,
    minRole: 'manager' as const,
  },
  {
    title: 'Media',
    href: '/admin/media',
    icon: Image,
    minRole: 'manager' as const,
  },
  {
    title: 'AI Agent',
    href: '/admin/ai-agent',
    icon: Sparkles,
    minRole: 'manager' as const,
  },
  {
    title: 'Logs',
    href: '/admin/logs',
    icon: ScrollText,
    minRole: 'manager' as const,
  },
  {
    title: 'Users',
    href: '/admin/users',
    icon: Users,
    minRole: 'manager' as const,
  },
  {
    title: 'Groups',
    href: '/admin/groups',
    icon: UsersRound,
    minRole: 'manager' as const,
  },
  {
    title: 'Settings',
    href: '/admin/settings',
    icon: Settings,
    minRole: 'manager' as const,
  },
]

export function AdminSidebar({ role }: { role?: string | null }) {
  const pathname = usePathname()
  const canManage = isManagerRole(role)
  const visibleItems = navItems.filter((item) => item.minRole === 'staff' || canManage)
  const [collapsed, setCollapsed] = useState<boolean>(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('adminSidebarCollapsed')
      queueMicrotask(() => setCollapsed(stored === 'true'))
    } catch {
      // keep default
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('adminSidebarCollapsed', collapsed ? 'true' : 'false')
    } catch {
      // ignore
    }
  }, [collapsed])

  return (
    <div
      className={cn(
        'flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-r transition-all',
        adminGlassSidebar,
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 px-3 dark:border-white/15">
        <Link href="/admin/dashboard" className={cn('flex items-center gap-2', collapsed ? 'mx-auto' : '')}>
          <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            {!collapsed && 'Admin Panel'}
          </span>
        </Link>
        <button
          type="button"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => setCollapsed(!collapsed)}
          className="rounded-lg p-2 text-gray-700 transition-colors hover:bg-white/40 dark:text-gray-200 dark:hover:bg-white/10"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
      
      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain p-2">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-base font-medium transition-[background-color,border-color,box-shadow]',
                isActive
                  ? 'border-slate-300/50 bg-white/[0.55] text-primary shadow-sm backdrop-blur-md dark:border-white/20 dark:bg-white/[0.12] dark:text-white'
                  : 'text-gray-700 hover:border-slate-300/35 hover:bg-white/30 dark:text-gray-200 dark:hover:border-white/12 dark:hover:bg-white/[0.06]',
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className={cn(collapsed ? 'hidden' : '')}>{item.title}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
