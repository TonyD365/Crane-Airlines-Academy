import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { isManagerRole } from '@/lib/roles'
import { UsersAdminTable } from '@/components/admin/users-admin-table'

export default async function AdminUsersPage() {
  const session = await auth()
  // Trainers cannot manage users.
  if (!isManagerRole(session?.user?.role)) {
    redirect('/admin/completion')
  }
  const currentUserId = session?.user?.id ?? null
  const currentUserRole = session?.user?.role ?? null

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 md:text-4xl">Users</h1>
        <p className="mt-2 text-base text-muted-foreground md:text-lg">
          Create accounts and manage credentials: Pro access, group, and — for a President — role.
        </p>
      </div>
      <UsersAdminTable currentUserId={currentUserId} currentUserRole={currentUserRole} />
    </div>
  )
}
