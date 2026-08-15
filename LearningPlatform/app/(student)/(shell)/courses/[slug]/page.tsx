import { getPayload } from 'payload'
import config from '@payload-config'
import { notFound } from 'next/navigation'
import { ArrowLeft, Brain, Check, Layers, SquareStack, Zap } from 'lucide-react'

export const dynamic = 'force-dynamic'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import Image from 'next/image'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { CourseHeroTitle } from '@/components/courses/course-hero-title'
import { courseVisibleToGroup, getUserGroupId } from '@/lib/course-visibility'
import { studentGlassCard, studentGlassPill } from '@/lib/student-glass-styles'
import { cn } from '@/lib/utils'
import { ArchiveCourseButton, UnarchiveCourseButton } from '@/components/profile/archive-actions'

/** Same visual as dashboard `StatPill` in `flashcard-section.tsx` (server-safe duplicate). */
function CourseFlashcardStatPill({ label, count }: { label: string; count: number }) {
  return (
    <div
      className={cn(
        'flex min-w-[4.25rem] flex-col items-center justify-center rounded-2xl border px-2.5 py-2 md:min-w-[4.75rem] md:px-3 md:py-2.5',
        'border-slate-300/45 bg-white/[0.28] shadow-sm backdrop-blur-md dark:border-white/15 dark:bg-white/[0.1] dark:shadow-none',
      )}
    >
      <span className="text-xl font-bold tabular-nums text-slate-800 dark:text-gray-100 md:text-2xl">{count}</span>
      <span className="mt-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-slate-600 dark:text-gray-400 md:text-xs">
        {label}
      </span>
    </div>
  )
}

type DeckStats = { total: number; newCards: number; due: number }

function emptyDeckStats(): DeckStats {
  return { total: 0, newCards: 0, due: 0 }
}

/** Avoid “Module 1: Module 1: …” when CMS titles already include a module prefix. */
function moduleDisplayTitle(orderIndex: number, rawTitle?: string | null): string {
  const rest = (rawTitle ?? '').trim().replace(/^module\s*\d+\s*:\s*/i, '').trim()
  if (!rest) return `Module ${orderIndex + 1}`
  return `Module ${orderIndex + 1}: ${rest}`
}

function titlesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

const moduleFlashcardBoxClass = cn(
  'mt-4 rounded-xl border border-dashed border-primary/35 bg-primary/[0.06] p-4 dark:border-primary/40 dark:bg-primary/[0.12]',
)

/**
 * Pill links in flashcard strips: motion + hover like outline buttons.
 * Avoid large outer `box-shadow` on hover: it paints above earlier flex siblings and reads as a
 * “lit strip” on neighbouring glass pills (backdrop-blur makes it obvious).
 */
const flashcardActionLinkClass = cn(
  'relative z-0 isolate cursor-pointer transition-[color,box-shadow,transform,background-color,border-color] duration-200 ease-out',
  'motion-reduce:transition-[color,box-shadow,background-color,border-color] motion-reduce:duration-150',
  'hover:z-10 motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0',
  'hover:border-slate-400/70 hover:bg-white/[0.55] hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.55)]',
  'dark:hover:border-white/30 dark:hover:bg-white/[0.22] dark:hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]',
  'focus-visible:z-10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring',
)

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = await auth()
  const payload = await getPayload({ config })

  // Fetch course from Payload CMS
  const { docs: courses } = await payload.find({
    collection: 'courses',
    where: {
      slug: {
        equals: slug,
      },
      isPublished: {
        equals: true,
      },
    },
    depth: 1,
  })

  if (!courses || courses.length === 0) {
    notFound()
  }

  const course = courses[0]

  // Enforce group-based visibility: students only see courses published to a
  // group they belong to (empty publish list = visible to everyone). Admins are exempt.
  if (session?.user?.role !== 'ADMIN') {
    const userGroupId = await getUserGroupId(session?.user?.id)
    if (!courseVisibleToGroup((course as { publishGroupIds?: unknown }).publishGroupIds, userGroupId)) {
      notFound()
    }
  }

  // Fetch modules and lessons in PARALLEL (lessons filtered by course, not module IDs)
  const [{ docs: modules }, { docs: allLessons }] = await Promise.all([
    payload.find({
      collection: 'modules',
      where: { course: { equals: course.id }, isPublished: { equals: true } },
      sort: 'order',
    }),
    payload.find({
      collection: 'lessons',
      where: { course: { equals: course.id }, isPublished: { equals: true } },
      sort: 'order',
      limit: 1000,
    }),
  ])

  // Group lessons by module
  const lessonsByModule = allLessons.reduce((acc, lesson) => {
    const moduleId = typeof lesson.module === 'object' ? lesson.module.id : lesson.module
    if (!acc[String(moduleId)]) {
      acc[String(moduleId)] = []
    }
    acc[String(moduleId)].push(lesson)
    return acc
  }, {} as Record<string, typeof allLessons>)

  interface ModuleWithLessons {
    id: string | number
    title?: string
    lessons: typeof allLessons
    [key: string]: unknown
  }

  // Attach lessons to modules
  const modulesWithLessons: ModuleWithLessons[] = modules.map(courseModule => ({
    ...courseModule,
    lessons: lessonsByModule[String(courseModule.id)] || [],
  }))

  const lessonIds = allLessons.map((l) => String(l.id))
  const completedLessonIds = new Set<string>()
  if (session?.user?.id && lessonIds.length > 0) {
    const rows = await prisma.lessonProgress.findMany({
      where: {
        userId: session.user.id,
        lessonId: { in: lessonIds },
        status: 'COMPLETED',
      },
      select: { lessonId: true },
    })
    for (const r of rows) {
      completedLessonIds.add(r.lessonId)
    }
  }

  const courseId = String(course.id)
  let courseArchived = false
  if (session?.user?.id) {
    const archivedCourse = await prisma.courseProgress.findFirst({
      where: {
        userId: session.user.id,
        courseId,
      },
      select: { archivedAt: true },
    })
    courseArchived = Boolean(archivedCourse?.archivedAt)
  }
  const moduleIds = modulesWithLessons.map((m) => String(m.id))
  let mainDeck = await prisma.flashcardDeck.findFirst({
    where: { courseId, parentDeckId: null },
    select: { id: true, name: true, slug: true },
  })
  if (mainDeck && session?.user?.id) {
    const archivedDeck = await prisma.userStandaloneFlashcardDeck.findUnique({
      where: { userId_deckId: { userId: session.user.id, deckId: mainDeck.id } },
      select: { archivedAt: true },
    })
    if (archivedDeck?.archivedAt) {
      mainDeck = null
    }
  }

  const subdecks = mainDeck
    ? await prisma.flashcardDeck.findMany({
        where: { parentDeckId: mainDeck.id, moduleId: { in: moduleIds } },
        select: { id: true, name: true, slug: true, moduleId: true },
      })
    : []

  const trackedDeckIds = [...new Set([...(mainDeck ? [mainDeck.id] : []), ...subdecks.map((d) => d.id)])]
  const statsByDeckId = new Map<string, DeckStats>()
  for (const id of trackedDeckIds) statsByDeckId.set(id, emptyDeckStats())

  if (trackedDeckIds.length > 0) {
    const flashcardProgressUserId = session?.user?.id ?? '__anonymous__'
    const flashcardRows = await prisma.flashcard.findMany({
      where: { deckId: { in: trackedDeckIds } },
      select: {
        id: true,
        deckId: true,
        userProgress: { where: { userId: flashcardProgressUserId }, select: { state: true, nextReviewAt: true } },
      },
    })
    const now = new Date()
    for (const row of flashcardRows) {
      const target = statsByDeckId.get(row.deckId)
      if (!target) continue
      target.total += 1
      const progress = row.userProgress[0]
      const state = progress?.state ?? 'NEW'
      if (state === 'NEW') {
        target.newCards += 1
      } else if (progress?.nextReviewAt && progress.nextReviewAt <= now) {
        target.due += 1
      }
    }
  }

  const subdeckByModuleId = new Map<string, { id: string; name: string; slug: string; stats: DeckStats }>()
  for (const subdeck of subdecks) {
    if (!subdeck.moduleId) continue
    subdeckByModuleId.set(subdeck.moduleId, {
      id: subdeck.id,
      name: subdeck.name,
      slug: subdeck.slug,
      stats: statsByDeckId.get(subdeck.id) ?? emptyDeckStats(),
    })
  }

  const combinedDeckStats = emptyDeckStats()
  if (mainDeck) {
    const mainOwn = statsByDeckId.get(mainDeck.id) ?? emptyDeckStats()
    combinedDeckStats.total += mainOwn.total
    combinedDeckStats.newCards += mainOwn.newCards
    combinedDeckStats.due += mainOwn.due
    for (const subdeck of subdecks) {
      const stats = statsByDeckId.get(subdeck.id) ?? emptyDeckStats()
      combinedDeckStats.total += stats.total
      combinedDeckStats.newCards += stats.newCards
      combinedDeckStats.due += stats.due
    }
  }

  return (
    <div className="container mx-auto max-w-5xl space-y-8 px-5 py-7 md:px-6 md:py-8">
      <div className="flex justify-start">
        <Button variant="outline" size="sm" asChild className="shrink-0">
          <Link href="/dashboard" className="inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to dashboard
          </Link>
        </Button>
      </div>

      {/* Hero — same liquid glass language as the student dashboard */}
      <Card className={cn('overflow-hidden border-0 p-0 shadow-none', studentGlassCard)}>
        {course.coverImage && typeof course.coverImage === 'object' && (
          <div className="relative h-52 w-full overflow-hidden sm:h-56 md:h-64">
            <Image
              src={`/api/media/serve/${encodeURIComponent(course.coverImage.filename)}`}
              alt={course.coverImage.alt || course.title}
              fill
              unoptimized
              className="object-cover"
            />
          </div>
        )}

        <div className="space-y-4 px-5 pb-6 pt-5 text-center sm:px-6 sm:pt-6">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {course.level ? (
              <span className={cn(studentGlassPill, 'text-sm uppercase')}>{course.level}</span>
            ) : null}
            {typeof course.subject === 'string' && course.subject ? (
              <span className={cn(studentGlassPill, 'text-sm font-medium normal-case tracking-tight')}>
                {course.subject}
              </span>
            ) : (course.subject as { name?: string } | null)?.name ? (
              <span className={cn(studentGlassPill, 'text-sm font-medium normal-case tracking-tight')}>
                {(course.subject as { name?: string }).name}
              </span>
            ) : null}
          </div>

          <CourseHeroTitle>{course.title}</CourseHeroTitle>

          {course.description && (
            <div className="mx-auto max-w-3xl text-base leading-relaxed text-gray-600 dark:text-gray-400 md:text-lg">
              {typeof course.description === 'string' ? (
                <p>{course.description}</p>
              ) : (
                <p>Explore the full set of topics covered in this course.</p>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Modules and lessons */}
      <section className="space-y-5">

        {modulesWithLessons.length === 0 ? (
          <Card className={cn('border-0 shadow-none', studentGlassCard)}>
            <CardContent className="px-5 py-10 text-center sm:px-6">
              <p className="text-base text-gray-600 dark:text-gray-400 md:text-lg">
                Course content is being prepared. Check back soon!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {modulesWithLessons.map((courseModule, index) => (
              <Card
                key={courseModule.id}
                className={cn('gap-0 border-0 py-0 shadow-none sm:gap-0', studentGlassCard)}
              >
                <CardHeader className="space-y-1 px-5 pb-3 pt-5 sm:px-6 sm:pt-6">
                  <CardTitle className="text-left text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 md:text-2xl">
                    {moduleDisplayTitle(index, String(courseModule.title ?? ''))}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 px-5 pb-5 sm:px-6 sm:pb-6">
                  {courseModule.lessons.length === 0 ? (
                    <p className="text-sm text-gray-600 dark:text-gray-400">No lessons available</p>
                  ) : (
                    <div className="space-y-2.5">
                      {courseModule.lessons.map((lesson) => (
                        <Link
                          key={lesson.id}
                          href={`/courses/${slug}/lessons/${lesson.id}`}
                          className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          <div
                            className={cn(
                              'flex min-h-[3.25rem] items-center gap-3 rounded-xl border p-3 shadow-sm backdrop-blur-md transition-[border-color,background-color,box-shadow] duration-200',
                              'border-slate-300/45 bg-white/[0.28] group-hover:border-slate-400/55 group-hover:bg-white/[0.38] group-hover:shadow-md',
                              'dark:border-white/12 dark:bg-white/[0.06] dark:shadow-none dark:group-hover:border-white/18 dark:group-hover:bg-white/[0.1] dark:group-hover:shadow-lg dark:group-hover:shadow-black/20',
                            )}
                          >
                            <div
                              className={cn(
                                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                                'bg-primary/12 text-primary group-hover:bg-primary/18',
                                'dark:bg-primary/25 dark:text-white dark:group-hover:bg-primary/35',
                              )}
                            >
                              {lesson.order}
                            </div>
                            <span className="min-w-0 flex-1 text-left font-medium text-gray-900 dark:text-gray-100">
                              {lesson.title}
                            </span>
                            {completedLessonIds.has(String(lesson.id)) && (
                              <span
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-500/35 bg-emerald-500/[0.12] text-emerald-600 dark:border-emerald-400/40 dark:bg-emerald-400/15 dark:text-emerald-400"
                                aria-label="Lesson completed"
                              >
                                <Check className="h-4 w-4" strokeWidth={2.75} aria-hidden />
                              </span>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}

                  {(() => {
                    const moduleSubdeck = subdeckByModuleId.get(String(courseModule.id))
                    if (!moduleSubdeck) return null
                    const subdeckSlugQ = encodeURIComponent(moduleSubdeck.slug)
                    const rawModTitle = String(courseModule.title ?? '').trim()
                    const showSubdeckName =
                      Boolean(moduleSubdeck.name.trim()) && !titlesMatch(moduleSubdeck.name, rawModTitle)
                    return (
                      <div className={moduleFlashcardBoxClass}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 flex-1 gap-3">
                            <div
                              className={cn(
                                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                                'bg-primary/12 text-primary dark:bg-primary/25 dark:text-white',
                              )}
                              aria-hidden
                            >
                              <SquareStack className="h-4 w-4" strokeWidth={2.25} />
                            </div>
                            <div className="min-w-0 space-y-1">
                              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Flashcards</p>
                              {showSubdeckName ? (
                                <p className="truncate text-xs text-muted-foreground">{moduleSubdeck.name}</p>
                              ) : null}
                              <p className="text-xs tabular-nums text-gray-600 dark:text-gray-400">
                                {moduleSubdeck.stats.total} cards · {moduleSubdeck.stats.newCards} new ·{' '}
                                {moduleSubdeck.stats.due} due
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                            <Link
                              href={`/dashboard/flashcards/study?mode=srs&subdeckSlug=${subdeckSlugQ}`}
                              className={cn(
                                studentGlassPill,
                                flashcardActionLinkClass,
                                'inline-flex items-center gap-1.5 py-2 text-xs normal-case tracking-tight',
                              )}
                            >
                              <Brain className="h-3.5 w-3.5 shrink-0" />
                              SRS study
                            </Link>
                            <Link
                              href={`/dashboard/flashcards/study?mode=free&subdeckSlug=${subdeckSlugQ}`}
                              className={cn(
                                studentGlassPill,
                                flashcardActionLinkClass,
                                'inline-flex items-center gap-1.5 py-2 text-xs normal-case tracking-tight',
                              )}
                            >
                              <Zap className="h-3.5 w-3.5 shrink-0" />
                              Free study
                            </Link>
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {mainDeck && (
        <section className="space-y-4">
          <div className="space-y-2 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 md:text-4xl">
              Flashcards for this course
            </h2>
            <p className="mx-auto max-w-2xl text-sm leading-relaxed text-gray-600 dark:text-gray-400 md:text-base">
              All flashcards for this course live in your dashboard. Study the full course deck (all modules) here, or use
              the module boxes above to focus one section at a time.
            </p>
          </div>
          <div className={cn(moduleFlashcardBoxClass, 'mt-0')}>
            <div className="flex flex-col items-center gap-5">
              <div className="w-full max-w-lg text-center">
                <p className="text-lg font-semibold tracking-tight text-gray-800 dark:text-gray-100 md:text-xl">
                  {String(course.title ?? '')}
                </p>
                {!titlesMatch(mainDeck.name, String(course.title ?? '')) ? (
                  <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">{mainDeck.name}</p>
                ) : null}
              </div>

              <div className="flex w-full max-w-md items-stretch justify-center gap-2 sm:gap-3">
                <CourseFlashcardStatPill label="due" count={combinedDeckStats.due} />
                <CourseFlashcardStatPill label="new" count={combinedDeckStats.newCards} />
                <CourseFlashcardStatPill label="total" count={combinedDeckStats.total} />
              </div>

              <div className="flex w-full max-w-xl flex-wrap justify-center gap-x-2 gap-y-3 px-0.5 pt-1">
                <Link
                  href={`/dashboard/flashcards/study?mode=srs&mainDeckSlug=${encodeURIComponent(mainDeck.slug)}`}
                  className={cn(
                    studentGlassPill,
                    flashcardActionLinkClass,
                    'inline-flex shrink-0 items-center justify-center gap-1.5 px-4 py-2 text-xs normal-case tracking-tight',
                  )}
                >
                  <Brain className="h-3.5 w-3.5 shrink-0" />
                  SRS study
                </Link>
                <Link
                  href={`/dashboard/flashcards/study?mode=free&mainDeckSlug=${encodeURIComponent(mainDeck.slug)}`}
                  className={cn(
                    studentGlassPill,
                    flashcardActionLinkClass,
                    'inline-flex shrink-0 items-center justify-center gap-1.5 px-4 py-2 text-xs normal-case tracking-tight',
                  )}
                >
                  <Zap className="h-3.5 w-3.5 shrink-0" />
                  Free study
                </Link>
                <Link
                  href={`/dashboard/flashcards?courseSlug=${encodeURIComponent(slug)}`}
                  className={cn(
                    studentGlassPill,
                    flashcardActionLinkClass,
                    'inline-flex shrink-0 items-center justify-center gap-1.5 px-4 py-2 text-xs normal-case tracking-tight',
                  )}
                >
                  <Layers className="h-3.5 w-3.5 shrink-0" />
                  Browse in dashboard
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="flex justify-center pt-2">
        {courseArchived ? (
          <UnarchiveCourseButton courseId={courseId} />
        ) : (
          <ArchiveCourseButton courseSlug={slug} />
        )}
      </section>
    </div>
  )
}
