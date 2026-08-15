import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { isStaffRole } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { adminGlassCard } from '@/lib/student-glass-styles'

export const dynamic = 'force-dynamic'

type CourseRow = {
  courseId: string
  title: string
  completedLessons: number
  totalLessons: number
  progressPercentage: number
}

type StudentRow = {
  id: string
  username: string | null
  name: string | null
  groupName: string | null
  courses: CourseRow[]
}

function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)))
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-200/70 dark:bg-white/10">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="w-10 text-right text-sm tabular-nums text-muted-foreground">{clamped}%</span>
    </div>
  )
}

export default async function AdminCompletionPage() {
  const session = await auth()
  const role = session?.user?.role
  if (!isStaffRole(role)) {
    redirect('/dashboard')
  }

  // Trainers are limited to their own group; Managers/Presidents see everyone.
  let groupFilterId: string | null = null
  let trainerHasNoGroup = false
  if (role === 'TRAINER') {
    const me = await prisma.user.findUnique({
      where: { id: session!.user.id },
      select: { groupId: true },
    })
    groupFilterId = me?.groupId ?? null
    trainerHasNoGroup = !groupFilterId
  }

  const students = trainerHasNoGroup
    ? []
    : await prisma.user.findMany({
        where: {
          role: 'STUDENT',
          ...(groupFilterId ? { groupId: groupFilterId } : {}),
        },
        select: {
          id: true,
          username: true,
          name: true,
          group: { select: { name: true } },
        },
        orderBy: [{ username: 'asc' }],
        take: 500,
      })

  const studentIds = students.map((s) => s.id)

  const progressRows = studentIds.length
    ? await prisma.courseProgress.findMany({
        where: { userId: { in: studentIds }, archivedAt: null },
        select: {
          userId: true,
          courseId: true,
          completedLessons: true,
          totalLessons: true,
          progressPercentage: true,
        },
      })
    : []

  // Course id → title from Payload.
  const titleById = new Map<string, string>()
  try {
    const payload = await getPayload({ config })
    const { docs } = await payload.find({ collection: 'courses', limit: 1000, depth: 0 })
    for (const c of docs) {
      titleById.set(String(c.id), String(c.title ?? 'Untitled course'))
    }
  } catch {
    // If Payload is unreachable we still render students with raw course ids.
  }

  const progressByUser = new Map<string, CourseRow[]>()
  for (const row of progressRows) {
    const list = progressByUser.get(row.userId) ?? []
    list.push({
      courseId: row.courseId,
      title: titleById.get(row.courseId) ?? 'Unknown course',
      completedLessons: row.completedLessons,
      totalLessons: row.totalLessons,
      progressPercentage: row.progressPercentage,
    })
    progressByUser.set(row.userId, list)
  }

  const rows: StudentRow[] = students.map((s) => ({
    id: s.id,
    username: s.username,
    name: s.name,
    groupName: s.group?.name ?? null,
    courses: (progressByUser.get(s.id) ?? []).sort((a, b) => a.title.localeCompare(b.title)),
  }))

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 md:text-4xl">
          Course completion
        </h1>
        <p className="mt-2 text-base text-muted-foreground md:text-lg">
          {role === 'TRAINER'
            ? 'Course progress for students in your group.'
            : 'Course progress across all students.'}
        </p>
      </div>

      {role === 'TRAINER' && trainerHasNoGroup ? (
        <div className={cn('rounded-xl border-0 p-6 shadow-none', adminGlassCard)}>
          <p className="text-muted-foreground">
            You are not assigned to a group yet. Ask a manager to add you to a group to see its
            students here.
          </p>
        </div>
      ) : rows.length === 0 ? (
        <div className={cn('rounded-xl border-0 p-6 shadow-none', adminGlassCard)}>
          <p className="text-muted-foreground">No students found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((student) => (
            <div key={student.id} className={cn('rounded-xl border-0 p-4 shadow-none md:p-6', adminGlassCard)}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {student.username ?? '—'}
                  </span>
                  {student.name ? (
                    <span className="ml-2 text-sm text-muted-foreground">({student.name})</span>
                  ) : null}
                </div>
                <span className="rounded-full border border-slate-300/50 bg-white/40 px-3 py-1 text-xs font-medium text-muted-foreground dark:border-white/15 dark:bg-white/[0.06]">
                  {student.groupName ? `Group: ${student.groupName}` : 'No group'}
                </span>
              </div>

              {student.courses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No courses started yet.</p>
              ) : (
                <div className="space-y-2">
                  {student.courses.map((course) => (
                    <div
                      key={course.courseId}
                      className="flex flex-col gap-2 rounded-lg border border-slate-200/60 px-3 py-2 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {course.title}
                      </span>
                      <div className="flex items-center gap-4">
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {course.completedLessons}/{course.totalLessons} lessons
                        </span>
                        <ProgressBar percent={course.progressPercentage} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
