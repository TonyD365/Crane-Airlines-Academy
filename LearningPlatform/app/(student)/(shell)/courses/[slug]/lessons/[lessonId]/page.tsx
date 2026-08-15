import { getPayload } from 'payload'
import config from '@payload-config'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { TheoryBlocksRenderer } from '@/components/student/theory-blocks-renderer'
import { LessonLegacyContent } from '@/components/student/lesson-legacy-content'
import { TaskCard } from '@/components/student/task-card'
import { auth } from '@/auth'
import { isStaffRole } from '@/lib/roles'
import { updateLesson } from '@/app/(admin)/admin/actions'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { AutoCompleteLesson } from '@/components/student/auto-complete-lesson'
import { lessonWithPopulatedTheoryImages } from '@/lib/populate-lesson-theory-images'
import { LessonAssistantShell, THEORY_ROOT_ID } from '@/components/student/lesson-assistant-fab'
import { studentGlassCard, studentGlassPill } from '@/lib/student-glass-styles'
import { cn } from '@/lib/utils'

export default async function LessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; lessonId: string }>
  searchParams?: Promise<{ preview?: string }>
}) {
  const { slug, lessonId } = await params
  const { preview } = (await searchParams) ?? {}
  const isPreview = preview === '1'
  const payload = await getPayload({ config })

  async function togglePublishAction(formData: FormData) {
    'use server'
    const nextState = formData.get('nextState')
    const targetLessonId = formData.get('lessonId')
    const targetSlug = formData.get('slug')
    if (typeof nextState !== 'string' || typeof targetLessonId !== 'string' || typeof targetSlug !== 'string') {
      return
    }
    await updateLesson(targetLessonId, { isPublished: nextState === 'true' })
    revalidatePath(`/courses/${targetSlug}/lessons/${targetLessonId}`)
  }

  // ─── Batch 1: auth + lesson in parallel ─────────────────────────────────────
  const [session, lessonRaw] = await Promise.all([
    auth(),
    payload.findByID({ collection: 'lessons', id: lessonId, depth: 2 }).catch(() => null),
  ])

  const lesson = lessonRaw
    ? await lessonWithPopulatedTheoryImages(lessonRaw, payload)
    : null

  const isAdmin = isStaffRole(session?.user?.role)
  const canUseLessonAssistant = session?.user?.isPro === true

  if (!lesson) notFound()
  if (!lesson.isPublished && !isAdmin) notFound()

  // Extract IDs from relationships (can be objects or IDs)
  const courseId = typeof lesson.course === 'object' ? lesson.course.id : lesson.course
  const moduleId = typeof lesson.module === 'object' ? lesson.module.id : lesson.module
  const navFilter = isAdmin && isPreview ? {} : { isPublished: { equals: true } }

  // ─── Batch 2: all secondary queries in parallel ──────────────────────────────
  // depth:1 on tasks auto-populates questionMedia + solutionMedia — eliminates N+1!
  const [course, courseModule, tasksResult, modulesForNav, allLessonsForNav] = await Promise.all([
    payload.findByID({ collection: 'courses', id: String(courseId) }).catch(() => null),
    payload.findByID({ collection: 'modules', id: String(moduleId) }).catch(() => null),
    payload.find({
      collection: 'tasks',
      where: { lesson: { equals: lessonId } },
      sort: 'order',
      depth: 1,
    }),
    payload.find({
      collection: 'modules',
      where: { course: { equals: courseId }, ...navFilter } as any,
      sort: 'order',
      depth: 0,
      limit: 1000,
    }),
    payload.find({
      collection: 'lessons',
      where: { course: { equals: courseId }, ...navFilter } as any,
      depth: 0,
      limit: 2000,
    }),
  ])

  if (!isAdmin && (!course || !course.isPublished || !courseModule || !courseModule.isPublished)) {
    notFound()
  }

  const tasks = tasksResult.docs
  const modules = modulesForNav.docs
  const allLessons = allLessonsForNav.docs

  // ─── Batch 3: progress queries in parallel (students only) ───────────────────
  const taskProgressMap = new Map<string, any>()
  let lessonProgress = null

  if (session?.user?.id && !isAdmin) {
    const taskIds = tasks.map((t: any) => String(t.id))
    const [taskProgressRecords, lessonProgressRecord] = await Promise.all([
      prisma.taskProgress.findMany({
        where: { userId: session.user.id, taskId: { in: taskIds } },
      }),
      prisma.lessonProgress.findUnique({
        where: { userId_lessonId: { userId: session.user.id, lessonId } },
      }),
      // If the user starts learning this course again, restore it to active.
      prisma.courseProgress.updateMany({
        where: {
          userId: session.user.id,
          courseId: String(courseId),
          archivedAt: { not: null },
        },
        data: { archivedAt: null },
      }),
    ])
    taskProgressRecords.forEach((tp) => taskProgressMap.set(tp.taskId, tp))
    lessonProgress = lessonProgressRecord
  } else if (session?.user?.id && isAdmin) {
    // Staff also track lesson completion (e.g. when reviewing/taking a course).
    lessonProgress = await prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId: session.user.id, lessonId } },
    })
  }

  const hasNoTasks = tasks.length === 0
  const isLessonCompleted = lessonProgress?.status === 'COMPLETED'

  const moduleIndex = new Map<string, number>()
  modules.forEach((m: any, i: number) => moduleIndex.set(String(m.id), i))

  const orderedLessons = [...allLessons].sort((a: any, b: any) => {
    const aModule = typeof a.module === 'object' ? String(a.module.id) : String(a.module)
    const bModule = typeof b.module === 'object' ? String(b.module.id) : String(b.module)
    const aModuleOrder = moduleIndex.has(aModule) ? moduleIndex.get(aModule)! : 0
    const bModuleOrder = moduleIndex.has(bModule) ? moduleIndex.get(bModule)! : 0
    if (aModuleOrder !== bModuleOrder) return aModuleOrder - bModuleOrder
    const aOrder = (a.order ?? 0) - (b.order ?? 0)
    return aOrder
  })

  const currentIndex = orderedLessons.findIndex((l: any) => String(l.id) === String(lessonId))
  const prevLesson = currentIndex > 0 ? orderedLessons[currentIndex - 1] : null
  const nextLesson = currentIndex >= 0 && currentIndex < orderedLessons.length - 1 ? orderedLessons[currentIndex + 1] : null

  const courseDoc = course as { level?: string; subject?: string | { name?: string } | null } | null
  const courseLevelStr = courseDoc?.level ? String(courseDoc.level) : ''
  const courseSubjectStr =
    typeof courseDoc?.subject === 'string'
      ? courseDoc.subject
      : courseDoc?.subject && typeof courseDoc.subject === 'object'
        ? String(courseDoc.subject.name ?? '')
        : ''

  const lessonHeader = (
    <>
      {/* Breadcrumb */}
      <div className="mb-6 text-sm text-muted-foreground">
        <Link href="/courses" className="hover:text-primary">
          Courses
        </Link>
        {' / '}
        <Link href={`/courses/${slug}`} className="hover:text-primary">
          {course?.title}
        </Link>
        {' / '}
        <span className="text-foreground">{lesson.title}</span>
      </div>

      {/* Lesson Header */}
      <div>
        <h1 className="mb-4 text-balance text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 md:text-4xl">
          {lesson.title}
        </h1>
        {(courseLevelStr || courseSubjectStr || courseModule) ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {courseLevelStr ? (
              <span className={cn(studentGlassPill, 'text-sm uppercase')}>{courseLevelStr}</span>
            ) : null}
            {courseSubjectStr ? (
              <span className={cn(studentGlassPill, 'max-w-full text-sm font-medium normal-case tracking-tight')}>
                {courseSubjectStr}
              </span>
            ) : null}
            {courseModule ? (
              <span className={cn(studentGlassPill, 'max-w-full text-sm font-medium normal-case tracking-tight')}>
                {String(courseModule.title ?? '')}
              </span>
            ) : null}
          </div>
        ) : null}
        {isAdmin && isPreview && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/admin/lessons/${lessonId}/builder`}>
              <Button variant="outline">Back to editor</Button>
            </Link>
            <form action={togglePublishAction}>
              <input type="hidden" name="lessonId" value={lessonId} />
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="nextState" value={lesson.isPublished ? 'false' : 'true'} />
              <Button type="submit">{lesson.isPublished ? 'Hide' : 'Publish'}</Button>
            </form>
          </div>
        )}
      </div>
    </>
  )

  const lessonBody = (
    <div className="space-y-8">
      {/* Lesson Content */}
      {(lesson.theoryBlocks && lesson.theoryBlocks.length > 0) || lesson.content ? (
        <Card className={cn('gap-0 border-0 py-0 shadow-none', studentGlassCard)}>
          <CardContent className="px-5 py-7 sm:px-7 sm:py-8 md:px-9">
            <div id={THEORY_ROOT_ID} className="min-w-0">
              {lesson.theoryBlocks && lesson.theoryBlocks.length > 0 ? (
                <TheoryBlocksRenderer blocks={lesson.theoryBlocks as Array<Record<string, unknown>> | undefined} />
              ) : (
                <LessonLegacyContent content={lesson.content} />
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Attachments */}
      {lesson.attachments && lesson.attachments.length > 0 && (
        <Card className={cn('border-0 shadow-none', studentGlassCard)}>
          <CardHeader>
            <CardTitle className="text-xl text-gray-900 dark:text-gray-100">Downloadable materials</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(lesson.attachments as Array<{ description?: string }>).map((attachment, index) => (
                <div
                  key={index}
                  className={cn(
                    'flex items-center justify-between rounded-xl border p-3',
                    'border-slate-300/45 bg-white/[0.22] backdrop-blur-md dark:border-white/12 dark:bg-white/[0.06]',
                  )}
                >
                  <span className="text-sm text-foreground">{attachment.description || `Attachment ${index + 1}`}</span>
                  <Button variant="outline" size="sm">
                    Download
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tasks */}
      <div className="space-y-5">
        <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 md:text-4xl">
          Practice tasks
        </h2>

        {tasks.length === 0 ? (
          <Card className={cn('border-0 shadow-none', studentGlassCard)}>
            <CardContent className="px-5 py-10 sm:px-6">
              <p className="text-center text-base text-gray-600 dark:text-gray-400 md:text-lg">
                No tasks for this lesson
              </p>
              {!!session?.user?.id && hasNoTasks && (
                <AutoCompleteLesson
                  lessonId={lessonId}
                  courseSlug={slug}
                  initialCompleted={isLessonCompleted}
                />
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {tasks.map((task, index) => {
              const taskId = String((task as Record<string, unknown>).id ?? index)
              const userProgress = taskProgressMap.get(taskId)
              
              return (
                <TaskCard
                  key={taskId}
                  task={task as Parameters<typeof TaskCard>[0]['task']}
                  index={index}
                  lessonId={lessonId}
                  courseSlug={slug}
                  userProgress={userProgress}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex flex-col justify-between gap-4 pt-2 sm:flex-row sm:items-center">
        <Link href={`/courses/${slug}`}>
          <Button variant="outline" className="w-full sm:w-auto">
            ← Back to course
          </Button>
        </Link>

        <div className="flex flex-wrap justify-end gap-2">
          {prevLesson ? (
            <Link href={`/courses/${slug}/lessons/${String(prevLesson.id)}`}>
              <Button variant="outline" className="min-w-[8.5rem]">
                ← Previous
              </Button>
            </Link>
          ) : (
            <Button variant="outline" disabled className="min-w-[8.5rem]">
              ← Previous
            </Button>
          )}

          {nextLesson ? (
            <Link href={`/courses/${slug}/lessons/${String(nextLesson.id)}`}>
              <Button variant="hero" className="auth-hero-cta min-w-[8.5rem]">
                Next lesson →
              </Button>
            </Link>
          ) : (
            <Button variant="outline" disabled className="min-w-[8.5rem]">
              Next →
            </Button>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <LessonAssistantShell
      lessonId={lessonId}
      courseSlug={slug}
      enabled={canUseLessonAssistant}
      lessonHeader={lessonHeader}
      lessonBody={lessonBody}
    />
  )
}
