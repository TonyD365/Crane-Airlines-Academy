import { getPayload } from 'payload'
import config from '@payload-config'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { courseVisibleToGroup, getUserGroupId } from '@/lib/course-visibility'
import { isStaffRole } from '@/lib/roles'
import {
  MoodleCourseView,
  type MoodleCourseMeta,
  type MoodleSection,
  type MoodleFlashcards,
  type MoodleMainDeck,
} from '@/components/courses/moodle-course-view'

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
  if (!isStaffRole(session?.user?.role)) {
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

  // ── Build serializable data for the Moodle-style course view ───────────────
  const bannerUrl =
    course.coverImage && typeof course.coverImage === 'object'
      ? `/api/media/serve/${encodeURIComponent((course.coverImage as { filename: string }).filename)}`
      : null
  const subjectLabel =
    typeof course.subject === 'string'
      ? course.subject
      : (course.subject as { name?: string } | null)?.name ?? ''
  const meta: MoodleCourseMeta = {
    title: String(course.title ?? ''),
    bannerUrl,
    level: String(course.level ?? ''),
    subjectLabel,
  }

  const sections: MoodleSection[] = modulesWithLessons.map((courseModule, index) => {
    const rawModTitle = String(courseModule.title ?? '').trim()
    const moduleSubdeck = subdeckByModuleId.get(String(courseModule.id))
    const flashcards: MoodleFlashcards | null = moduleSubdeck
      ? {
          name:
            moduleSubdeck.name.trim() && !titlesMatch(moduleSubdeck.name, rawModTitle)
              ? moduleSubdeck.name
              : null,
          total: moduleSubdeck.stats.total,
          newCards: moduleSubdeck.stats.newCards,
          due: moduleSubdeck.stats.due,
          srsHref: `/dashboard/flashcards/study?mode=srs&subdeckSlug=${encodeURIComponent(moduleSubdeck.slug)}`,
          freeHref: `/dashboard/flashcards/study?mode=free&subdeckSlug=${encodeURIComponent(moduleSubdeck.slug)}`,
        }
      : null
    return {
      id: String(courseModule.id),
      title: moduleDisplayTitle(index, rawModTitle),
      lessons: courseModule.lessons.map((lesson) => ({
        id: String(lesson.id),
        title: String((lesson as { title?: unknown }).title ?? ''),
        order: Number((lesson as { order?: unknown }).order ?? 0),
        href: `/courses/${slug}/lessons/${lesson.id}`,
        done: completedLessonIds.has(String(lesson.id)),
      })),
      flashcards,
    }
  })

  const mainDeckBlock: MoodleMainDeck | null = mainDeck
    ? {
        courseTitle: String(course.title ?? ''),
        name: !titlesMatch(mainDeck.name, String(course.title ?? '')) ? mainDeck.name : null,
        due: combinedDeckStats.due,
        newCards: combinedDeckStats.newCards,
        total: combinedDeckStats.total,
        srsHref: `/dashboard/flashcards/study?mode=srs&mainDeckSlug=${encodeURIComponent(mainDeck.slug)}`,
        freeHref: `/dashboard/flashcards/study?mode=free&mainDeckSlug=${encodeURIComponent(mainDeck.slug)}`,
        browseHref: `/dashboard/flashcards?courseSlug=${encodeURIComponent(slug)}`,
      }
    : null

  return (
    <MoodleCourseView
      slug={slug}
      meta={meta}
      sections={sections}
      mainDeck={mainDeckBlock}
      courseArchived={courseArchived}
      courseId={courseId}
    />
  )
}
