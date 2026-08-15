import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { isManagerRole } from '@/lib/roles'
import { getCourses } from '../actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ReloadButton } from '@/components/ui/reload-button'
import { CoursesList } from '@/components/admin/courses-list'
import { AddCourseButton } from '@/components/admin/add-course-button'
import { BookOpen, Users, GraduationCap } from 'lucide-react'
import { adminGlassCard } from '@/lib/student-glass-styles'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

type Course = {
  id: string
  title: string
  slug: string
  subject: string
  level: string
  isPublished: boolean
  createdAt: string
  updatedAt: string
  lastUpdatedBy: string | null
  createdVia: string | null
}

export default async function AdminDashboardPage() {
  // Trainers can't manage content — send them to the completion view.
  const session = await auth()
  if (!isManagerRole(session?.user?.role)) {
    redirect('/admin/completion')
  }

  const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build'

  let courses: Course[] = []
  let error: string | null = null

  if (!isBuildTime) {
    try {
      const coursesData = await getCourses()
      courses = coursesData.map((c: any) => ({
        id: String(c.id),
        title: c.title,
        slug: c.slug,
        subject: typeof c.subject === 'string' ? c.subject : c.subject?.name ?? '',
        level: c.level,
        isPublished: Boolean(c.isPublished),
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        lastUpdatedBy: typeof c.lastUpdatedBy === 'string' && c.lastUpdatedBy.trim() ? c.lastUpdatedBy.trim() : null,
        createdVia: typeof c.createdVia === 'string' ? c.createdVia : null,
      }))
    } catch (err) {
      console.error('Failed to fetch courses:', err)
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('Payload tables not initialized') || (msg.includes('relation') && msg.includes('does not exist'))) {
        error = '⚠️ The database is not initialized. Run migrations: npm run payload:migrate'
      } else {
        error = 'Unable to load courses. Please refresh the page.'
      }
    }
  }

  const stats = {
    totalCourses: courses.length,
    publishedCourses: courses.filter((x) => x.isPublished).length,
    draftCourses: courses.filter((x) => !x.isPublished).length,
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 md:text-4xl">Dashboard</h1>
          <p className="mt-2 text-base text-gray-600 dark:text-gray-400 md:text-lg">Manage courses and content</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AddCourseButton />
          <ReloadButton />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className={cn('border-0 shadow-none', adminGlassCard)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium text-gray-900 dark:text-gray-100">All courses</CardTitle>
            <BookOpen className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{stats.totalCourses}</div>
          </CardContent>
        </Card>

        <Card className={cn('border-0 shadow-none', adminGlassCard)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium text-gray-900 dark:text-gray-100">Published</CardTitle>
            <GraduationCap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{stats.publishedCourses}</div>
          </CardContent>
        </Card>

        <Card className={cn('border-0 shadow-none', adminGlassCard)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium text-gray-900 dark:text-gray-100">Drafts</CardTitle>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{stats.draftCourses}</div>
          </CardContent>
        </Card>
      </div>

      <Card className={cn('border-0 shadow-none', adminGlassCard)}>
        <CardHeader>
          <CardTitle className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Courses</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="py-8 text-center">
              <p className="mb-4 text-base text-red-600">{error}</p>
              <ReloadButton />
            </div>
          ) : courses.length === 0 ? (
            <div className="py-8 text-center">
              <p className="mb-4 text-base text-gray-500">No courses yet.</p>
            </div>
          ) : (
            <CoursesList courses={courses} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
