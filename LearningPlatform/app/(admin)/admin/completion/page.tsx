import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@payload-config'
import { Check } from 'lucide-react'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { isStaffRole } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { adminGlassCard } from '@/lib/student-glass-styles'
import { StudentGroupSelect } from '@/components/admin/student-group-select'

export const dynamic = 'force-dynamic'

function firstString(v: string | string[] | undefined): string {
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v[0] ?? ''
  return ''
}

function moduleTitle(index: number, raw: string): string {
  const rest = (raw ?? '').trim().replace(/^module\s*\d+\s*:\s*/i, '').trim()
  return rest ? `Module ${index + 1}: ${rest}` : `Module ${index + 1}`
}

type Lesson = { id: string; title: string }
type ModuleGroup = { id: string; title: string; lessons: Lesson[] }

export default async function AdminCompletionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await auth()
  const role = session?.user?.role
  if (!isStaffRole(role)) {
    redirect('/dashboard')
  }

  const raw = await searchParams
  const payload = await getPayload({ config })

  // Courses for the selector.
  const { docs: courseDocs } = await payload.find({
    collection: 'courses',
    where: { isPublished: { equals: true } },
    sort: 'title',
    limit: 500,
    depth: 0,
  })
  const courses = courseDocs.map((c) => ({
    id: String(c.id),
    title: String(c.title ?? 'Untitled course'),
  }))

  const header = (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 md:text-4xl">
        Course completion
      </h1>
      <p className="mt-2 text-base text-muted-foreground md:text-lg">
        Per-student progress for every module and lesson in a course. You can also set a student&rsquo;s group.
      </p>
    </div>
  )

  if (courses.length === 0) {
    return (
      <div className="mx-auto max-w-6xl space-y-8">
        {header}
        <div className={cn('rounded-xl border-0 p-6 shadow-none', adminGlassCard)}>
          <p className="text-muted-foreground">No published courses yet.</p>
        </div>
      </div>
    )
  }

  const selectedId = firstString(raw.course) || courses[0].id
  const selected = courses.find((c) => c.id === selectedId) ?? courses[0]

  // Modules + lessons of the selected course.
  const [{ docs: moduleDocs }, { docs: lessonDocs }] = await Promise.all([
    payload.find({
      collection: 'modules',
      where: { course: { equals: selected.id }, isPublished: { equals: true } },
      sort: 'order',
      limit: 1000,
      depth: 0,
    }),
    payload.find({
      collection: 'lessons',
      where: { course: { equals: selected.id }, isPublished: { equals: true } },
      sort: 'order',
      limit: 5000,
      depth: 0,
    }),
  ])

  const lessonsByModule = new Map<string, Lesson[]>()
  for (const l of lessonDocs) {
    const mid = String(typeof l.module === 'object' && l.module ? (l.module as { id: string }).id : l.module)
    const list = lessonsByModule.get(mid) ?? []
    list.push({ id: String(l.id), title: String(l.title ?? '') })
    lessonsByModule.set(mid, list)
  }

  const modules: ModuleGroup[] = moduleDocs.map((m, i) => ({
    id: String(m.id),
    title: moduleTitle(i, String(m.title ?? '')),
    lessons: lessonsByModule.get(String(m.id)) ?? [],
  }))

  const allLessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id))
  const totalLessons = allLessonIds.length

  // Students + groups.
  const [students, groups] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'STUDENT' },
      select: { id: true, username: true, name: true, groupId: true },
      orderBy: [{ username: 'asc' }],
      take: 1000,
    }),
    prisma.group.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ])
  const studentIds = students.map((s) => s.id)

  const completed = new Set<string>()
  if (studentIds.length && allLessonIds.length) {
    const rows = await prisma.lessonProgress.findMany({
      where: { userId: { in: studentIds }, lessonId: { in: allLessonIds }, status: 'COMPLETED' },
      select: { userId: true, lessonId: true },
    })
    for (const r of rows) completed.add(`${r.userId}:${r.lessonId}`)
  }

  const doneCell = (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
      <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
    </span>
  )
  const notDoneCell = <span className="text-slate-300 dark:text-slate-600">–</span>

  return (
    <div className="mx-auto max-w-full space-y-6">
      {header}

      {/* Course selector */}
      <div className="flex flex-wrap gap-2">
        {courses.map((c) => {
          const active = c.id === selected.id
          return (
            <Link
              key={c.id}
              href={`/admin/completion?course=${encodeURIComponent(c.id)}`}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'border-[#2b295c] bg-[#2b295c] text-white dark:border-indigo-400 dark:bg-indigo-500'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-[#2b295c] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200',
              )}
            >
              {c.title}
            </Link>
          )
        })}
      </div>

      <div className={cn('overflow-hidden rounded-xl border-0 p-3 shadow-none sm:p-4', adminGlassCard)}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{selected.title}</h2>
          <span className="text-sm text-muted-foreground">
            {students.length} student{students.length === 1 ? '' : 's'} · {totalLessons} lesson
            {totalLessons === 1 ? '' : 's'}
          </span>
        </div>

        {totalLessons === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            This course has no published lessons yet.
          </p>
        ) : students.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No students found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="sticky left-0 z-10 bg-white/90 px-3 py-2 text-left font-semibold text-slate-700 backdrop-blur dark:bg-slate-900/90 dark:text-slate-200" rowSpan={2}>
                    Student
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200" rowSpan={2}>
                    Group
                  </th>
                  {modules.map((m) => (
                    <th
                      key={m.id}
                      colSpan={Math.max(1, m.lessons.length)}
                      className="border-l border-slate-200 px-2 py-2 text-center font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                    >
                      {m.title}
                    </th>
                  ))}
                  <th className="border-l border-slate-200 px-3 py-2 text-center font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200" rowSpan={2}>
                    Overall
                  </th>
                </tr>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  {modules.flatMap((m) =>
                    m.lessons.length > 0
                      ? m.lessons.map((l) => (
                          <th
                            key={l.id}
                            title={l.title}
                            className="max-w-[8rem] truncate border-l border-slate-100 px-2 py-2 text-center align-bottom text-xs font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400"
                          >
                            {l.title}
                          </th>
                        ))
                      : [
                          <th
                            key={`${m.id}-empty`}
                            className="border-l border-slate-100 px-2 py-2 text-center text-xs text-slate-400 dark:border-slate-800"
                          >
                            —
                          </th>,
                        ],
                  )}
                </tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  const doneCount = allLessonIds.filter((id) => completed.has(`${s.id}:${id}`)).length
                  return (
                    <tr key={s.id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="sticky left-0 z-10 whitespace-nowrap bg-white/90 px-3 py-2 font-medium text-slate-900 backdrop-blur dark:bg-slate-900/90 dark:text-slate-100">
                        {s.username ?? '—'}
                        {s.name ? <span className="ml-1 text-xs text-muted-foreground">({s.name})</span> : null}
                      </td>
                      <td className="px-3 py-2">
                        <StudentGroupSelect userId={s.id} initialGroupId={s.groupId} groups={groups} />
                      </td>
                      {modules.flatMap((m) =>
                        m.lessons.length > 0
                          ? m.lessons.map((l) => (
                              <td key={l.id} className="border-l border-slate-100 px-2 py-2 text-center dark:border-slate-800">
                                {completed.has(`${s.id}:${l.id}`) ? doneCell : notDoneCell}
                              </td>
                            ))
                          : [
                              <td key={`${m.id}-empty`} className="border-l border-slate-100 px-2 py-2 text-center dark:border-slate-800">
                                {notDoneCell}
                              </td>,
                            ],
                      )}
                      <td className="border-l border-slate-200 px-3 py-2 text-center font-medium tabular-nums text-slate-700 dark:border-slate-700 dark:text-slate-200">
                        {doneCount}/{totalLessons}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
