'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { checkLessonCompletion } from './lesson-progress'
import { recalculateCourseProgress } from './course-progress'
import { invalidateUserTagStatsCache } from '@/lib/analytics'
import { evaluateTaskAnswer as scoreTaskAnswer } from '@/lib/evaluate-task-answer'
import { isStaffRole } from '@/lib/roles'

// Module-level cache for payload lookups (enabled only in test env)
// Enable the short-lived module cache only when explicitly requested to avoid
// cross-test pollution. Set `USE_PAYLOAD_CACHE=1` when running a focused test
// session that needs caching; leave unset for full test runs and production.
const _payloadCache: Map<string, any> | undefined =
  process.env.NODE_ENV === 'test' && process.env.USE_PAYLOAD_CACHE === '1'
    ? new Map<string, any>()
    : undefined

/**
 * Submit a task answer (any submission counts as progress).
 * Enhanced with telemetry: isCorrect, difficultyRating, tags.
 */
export async function submitTaskAnswer(
  taskId: string,
  lessonId: string,
  answer: string,
  courseSlug: string,
  difficultyRating?: number // Optional: 1-5 scale for subjective feedback
) {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }

  const payload = await getPayload({ config })

  const getFromPayload = async (collection: string, id: string) => {
    const key = `${collection}:${id}`
    if (_payloadCache && _payloadCache.has(key)) return _payloadCache.get(key)
    const res = await payload.findByID({ collection, id })
    if (_payloadCache) _payloadCache.set(key, res)
    return res
  }

  // Cross-schema FK enforcement: TaskProgress.taskId references payload.tasks
  // but PostgreSQL cannot enforce this constraint across schemas.
  // requirePayloadDocument throws if the task is absent or unpublished.
  // The local _payloadCache (test-only) wraps the same findByID to speed up tests.
  const task = await getFromPayload('tasks', taskId)

  if (!task) {
    throw new Error('Task not found')
  }

  if (!task.isPublished && !isStaffRole(session.user.role)) {
    throw new Error('Task not found')
  }

  // Extract tags from task for analytics
  const taskTags = Array.isArray(task.tags)
    ? task.tags.map((t: any) => (t?.name || t?.tag || t?.slug || '')).filter(Boolean)
    : []

  // Look up canonical Tag IDs for the task's tags (by slug or name match)
  const canonicalTags = taskTags.length > 0
    ? await prisma.tag.findMany({
        where: {
          OR: [
            { slug: { in: taskTags.map((t: string) => t.toLowerCase().replace(/\s+/g, '-')) } },
            { name: { in: taskTags } },
          ],
        },
        select: { id: true },
      })
    : []

  // Cross-schema FK enforcement: LessonProgress.lessonId references payload.lessons.
  const lesson = await getFromPayload('lessons', lessonId)

  if (!lesson || !lesson.isPublished) {
    throw new Error('Lesson not found')
  }

  const courseId = typeof lesson.course === 'object' ? lesson.course.id : lesson.course

  // Get or create lesson progress
  const lessonProgress = await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId: session.user.id, lessonId } },
    create: {
      userId: session.user.id,
      lessonId,
      status: 'IN_PROGRESS',
      startedAt: new Date(),
    },
    update: { lastViewedAt: new Date() },
  })

  const { isCorrect, autoGraded } = scoreTaskAnswer(
    {
      type: task.type,
      correctAnswer: task.correctAnswer,
      autoGrade: task.autoGrade,
    },
    answer,
  )
  const earnedPoints = isCorrect ? task.points : 0

  const validatedRating = difficultyRating && difficultyRating >= 1 && difficultyRating <= 5
    ? difficultyRating
    : null

  const attemptedAt = new Date()

  const taskProgress = await prisma.taskProgress.upsert({
    where: { userId_taskId: { userId: session.user.id, taskId } },
    create: {
      userId: session.user.id,
      taskId,
      lessonProgressId: lessonProgress.id,
      submittedAnswer: answer,
      earnedPoints,
      maxPoints: task.points,
      isCorrect,
      difficultyRating: validatedRating,
      status: isCorrect ? 'PASSED' : 'ATTEMPTED',
      attemptedAt,
      passedAt: isCorrect ? attemptedAt : null,
    },
    update: {
      submittedAnswer: answer,
      earnedPoints,
      isCorrect,
      difficultyRating: validatedRating,
      status: isCorrect ? 'PASSED' : 'ATTEMPTED',
      attemptedAt,
      passedAt: isCorrect ? attemptedAt : null,
    },
  })

  // Persist append-only attempt history for longitudinal analytics.
  try {
    const taskAttempt = await prisma.taskAttempt.create({
      data: {
        userId: session.user.id,
        taskId,
        lessonProgressId: lessonProgress.id,
        taskProgressId: taskProgress.id,
        submittedAnswer: answer,
        earnedPoints,
        maxPoints: task.points,
        isCorrect,
        difficultyRating: validatedRating,
        attemptedAt,
      },
      select: { id: true },
    })

    if (canonicalTags.length > 0) {
      await prisma.taskAttemptTag.createMany({
        data: canonicalTags.map((t) => ({ taskAttemptId: taskAttempt.id, tagId: t.id })),
        skipDuplicates: true,
      })
    }
  } catch (attemptLogErr) {
    console.warn('[submitTaskAnswer] TaskAttempt logging failed:', attemptLogErr)
  }

  await checkLessonCompletion(session.user.id, lessonId, session.user?.role)

  // Sync normalised TaskProgressTag records (best-effort, non-blocking)
  if (canonicalTags.length > 0) {
    try {
      await prisma.$transaction(
        canonicalTags.map((t) =>
          prisma.taskProgressTag.upsert({
            where: { taskProgressId_tagId: { taskProgressId: taskProgress.id, tagId: t.id } },
            create: { taskProgressId: taskProgress.id, tagId: t.id },
            update: {},
          })
        )
      )
    } catch (tagSyncErr) {
      console.warn('[submitTaskAnswer] TaskProgressTag sync failed:', tagSyncErr)
    }
  }

  await recalculateCourseProgress(session.user.id, String(courseId))

  // Invalidate the per-user analytics cache so the next recommendation or
  // practice session request reflects this newly submitted result immediately
  // rather than serving a stale 60-second cached response.
  invalidateUserTagStatsCache(session.user.id)

  revalidatePath(`/courses/${courseSlug}/lessons/${lessonId}`)
  revalidatePath(`/courses/${courseSlug}`)
  revalidatePath('/dashboard')

  return { taskProgress, isCorrect, earnedPoints, autoGraded }
}
