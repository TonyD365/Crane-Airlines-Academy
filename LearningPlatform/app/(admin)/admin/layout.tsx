export const dynamic = 'force-dynamic'

import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { AdminSidebar } from '@/components/admin/sidebar'
import { AdminTopbar } from '@/components/admin/topbar'
import { isStaffRole } from '@/lib/roles'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  // Protect admin routes - only ADMIN role
  if (!session?.user) {
    redirect('/admin/login')
  }
  
  // Safe guard: only staff (Trainer, Manager, President) may enter the admin panel.
  const userRole = session.user?.role;
  if (!isStaffRole(userRole)) {
    redirect('/dashboard')
  }

  return (
    <div className="relative isolate h-dvh max-h-dvh w-full overflow-hidden">
      <div className="student-app-shell-bg" aria-hidden />
      <div className="relative z-[1] flex h-dvh max-h-dvh w-full flex-row overflow-hidden bg-transparent">
        <AdminSidebar role={userRole} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <AdminTopbar user={session.user} />
          <main className="min-h-0 flex-1 overflow-y-auto px-5 py-6 text-base leading-relaxed md:px-8 md:py-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
