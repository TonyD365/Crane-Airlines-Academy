import { GroupsAdmin } from '@/components/admin/groups-admin'

export const dynamic = 'force-dynamic'

export default function AdminGroupsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 md:text-4xl">
          Student groups
        </h1>
        <p className="mt-2 text-base text-muted-foreground md:text-lg">
          Create and manage groups, and assign students to them. Courses can be published to
          specific groups from the course editor.
        </p>
      </div>
      <GroupsAdmin />
    </div>
  )
}
