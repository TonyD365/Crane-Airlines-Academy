import { auth } from '@/auth'
import { getPayload } from 'payload'
import Link from 'next/link'
import type { CourseProgress } from '@prisma/client'

export const dynamic = 'force-dynamic'
import config from '@payload-config'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ReloadButton } from '@/components/ui/reload-button'
import { timeAsync, cn } from '@/lib/utils'
import { getUserStats, getAllCourseProgress, getPopularCourseIds } from '@/app/actions/progress'
import { FlashcardDashboardSection } from '@/components/dashboard/flashcard-section'
import { RecommendedPracticeCard } from '@/components/dashboard/recommended-practice-card'
import {
  CourseCarousel,
  type CourseProgressSnapshot,
} from '@/components/dashboard/course-carousel'
import { fetchPublishedCoursesByIdsInOrder } from '@/lib/started-courses'
import { courseVisibleToGroup, getUserGroupId } from '@/lib/course-visibility'
import { AllCoursesPromo } from '@/components/dashboard/all-courses-promo'
import { CreativeSpaceDashboardPromo } from '@/components/dashboard/creative-space-dashboard-promo'
import { studentGlassCard } from '@/lib/student-glass-styles'
export default async function DashboardPage() {
  const session = await auth()

  interface CourseSummary {
    id: string | number
    title?: string
    slug?: string
    description?: string | object | null
    coverImage?: { filename: string; alt?: string } | null
    level?: string
    subject?: string
  }

  let yourCourses: CourseSummary[] = []
  let popularCourses: CourseSummary[] = []
  let error: string | null = null
  let userStats = { completedLessons: 0, totalPoints: 0, activeCourses: 0 }
  const courseProgressMap = new Map<string, CourseProgress>()

  try {
    const payload = await getPayload({ config })

    if (session?.user?.id) {
      const [statsTimed, allProgress, popularIdsTimed] = await Promise.all([
        timeAsync('student-dashboard:user-stats', () => getUserStats(payload)),
        getAllCourseProgress(),
        timeAsync('student-dashboard:popular-ids', () => getPopularCourseIds()),
      ])

      const { startedCourseIds, ...restStats } = statsTimed.result
      userStats = restStats
      allProgress.forEach((progress) => {
        courseProgressMap.set(progress.courseId, progress)
      })

      const popularIds = popularIdsTimed.result
      const [yourTimed, popularTimed] = await Promise.all([
        timeAsync('student-dashboard:your-course-docs', () =>
          fetchPublishedCoursesByIdsInOrder(payload, startedCourseIds, 1),
        ),
        timeAsync('student-dashboard:popular-course-docs', () =>
          fetchPublishedCoursesByIdsInOrder(payload, popularIds, 1),
        ),
      ])
      yourCourses = yourTimed.result as CourseSummary[]
      popularCourses = popularTimed.result as CourseSummary[]

      // Hide courses the student's group is not allowed to see (admins exempt).
      if (session.user.role !== 'ADMIN') {
        const groupId = await getUserGroupId(session.user.id)
        const visible = (c: CourseSummary) =>
          courseVisibleToGroup((c as { publishGroupIds?: unknown }).publishGroupIds, groupId)
        yourCourses = yourCourses.filter(visible)
        popularCourses = popularCourses.filter(visible)
      }
    }
  } catch {
    error = 'Unable to load courses. Please refresh the page.'
  }

  const progressByCourseId: Record<string, CourseProgressSnapshot> = {}
  for (const [id, p] of courseProgressMap.entries()) {
    progressByCourseId[id] = {
      progressPercentage: p?.progressPercentage ?? 0,
      completedLessons: p?.completedLessons ?? 0,
      totalLessons: p?.totalLessons ?? 0,
      hasStarted: !!p,
    }
  }

  const progressForYourCourses: Record<string, CourseProgressSnapshot> = {}
  for (const course of yourCourses) {
    const id = String(course.id)
    const base = progressByCourseId[id] ?? {
      progressPercentage: 0,
      completedLessons: 0,
      totalLessons: 0,
      hasStarted: false,
    }
    progressForYourCourses[id] = { ...base, hasStarted: true }
  }

  return (
    <div className="container mx-auto px-5 py-7 md:px-6 md:py-8">
      <div className="mx-auto w-full max-w-5xl space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 md:text-4xl">
            Welcome, {session?.user?.name || session?.user?.email}!
          </h1>
          <p className="mt-2 text-base leading-relaxed text-gray-600 dark:text-gray-400 md:text-lg">
            Ready for your next learning session?
          </p>
        </div>

        <div className="grid w-full gap-5 md:grid-cols-3 md:gap-6">
          <Card className={cn('border-0 shadow-none', studentGlassCard)}>
            <CardHeader className="pb-3 text-center">
              <CardDescription className="text-base leading-relaxed text-muted-foreground md:text-lg">
                Completed lessons
              </CardDescription>
              <CardTitle className="mt-2 text-3xl font-bold text-purple-600 md:text-4xl">
                {userStats.completedLessons}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className={cn('border-0 shadow-none', studentGlassCard)}>
            <CardHeader className="pb-3 text-center">
              <CardDescription className="text-base leading-relaxed text-muted-foreground md:text-lg">
                Total points earned
              </CardDescription>
              <CardTitle className="mt-2 text-3xl font-bold text-green-600 md:text-4xl">
                {userStats.totalPoints}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className={cn('border-0 shadow-none', studentGlassCard)}>
            <CardHeader className="pb-3 text-center">
              <CardDescription className="text-base leading-relaxed text-muted-foreground md:text-lg">
                Active courses
              </CardDescription>
              <CardTitle className="mt-2 text-3xl font-bold text-blue-600 md:text-4xl">
                {userStats.activeCourses}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="w-full">
          <RecommendedPracticeCard />
        </div>

        <div className="w-full">
          <div className="mb-4 text-center md:mb-5">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 md:text-4xl">
              Your courses
            </h2>
          </div>

          {error ? (
            <Card className={cn('border-0 shadow-none', studentGlassCard)}>
              <CardContent className="pt-6">
                <p className="mb-4 text-center text-base leading-relaxed text-red-600 dark:text-red-400 md:text-lg">
                  {error}
                </p>
                <div className="flex justify-center">
                  <ReloadButton variant="hero" />
                </div>
              </CardContent>
            </Card>
          ) : yourCourses.length === 0 ? (
            <Card className={cn('border-0 shadow-none', studentGlassCard)}>
              <CardContent className="space-y-4 pt-6">
                <p className="text-center text-base leading-relaxed text-gray-600 dark:text-gray-400 md:text-lg">
                  You have not started any courses yet. Browse the catalog to begin learning.
                </p>
                <div className="flex justify-center">
                  <Button asChild variant="hero" className="auth-hero-cta">
                    <Link href="/courses">Browse courses</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <CourseCarousel
              courses={yourCourses}
              progressByCourseId={progressForYourCourses}
              scrollAriaLabel="Your courses"
            />
          )}
        </div>

        <div className="w-full">
          <div className="mb-4 text-center md:mb-5">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 md:text-4xl">
              Most popular
            </h2>
            <p className="mt-2 text-balance text-base leading-relaxed text-gray-600 dark:text-gray-400 md:text-lg lg:whitespace-nowrap">
              Explore our most popular courses. See what other learners are starting right now.
            </p>
          </div>

          {error ? null : popularCourses.length === 0 ? (
            <Card className={cn('border-0 shadow-none', studentGlassCard)}>
              <CardContent className="pt-6">
                <p className="text-center text-base leading-relaxed text-gray-500 dark:text-gray-400 md:text-lg">
                  No published courses are available yet. Check back soon.
                </p>
              </CardContent>
            </Card>
          ) : (
            <CourseCarousel
              courses={popularCourses}
              progressByCourseId={progressByCourseId}
              scrollAriaLabel="Most popular courses"
            />
          )}
        </div>

        {!error && <AllCoursesPromo />}

        <div className="w-full pt-2">
          <FlashcardDashboardSection>
            <CreativeSpaceDashboardPromo />
          </FlashcardDashboardSection>
        </div>
      </div>
    </div>
  )
}
