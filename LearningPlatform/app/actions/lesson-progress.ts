'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { recalculateCourseProgress } from './course-progress'
import { requirePayloadDocument } from '@/lib/payload-validate'
import { isStaffRole } from '@/lib/roles'

/**
 * Mark a lesson as complete (for lessons without tasks).
 */
export async function markLessonComplete(lessonId: string, courseSlug: string) {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }

  // requirePayloadDocument enforces the cross-schema FK contract:
  // LessonProgress.lessonId references payload.lessons but PostgreSQL cannot
  // enforce this constraint across schemas.  Throws if the lesson is absent
  // or unpublished (non-admin callers).
  const lesson = await requirePayloadDocument('lessons', lessonId)

  const courseId = typeof lesson.course === 'object'
    ? (lesson.course as { id: string }).id
    : (lesson.course as string)

  await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId: session.user.id, lessonId } },
    create: {
      userId: session.user.id,
      lessonId,
      status: 'COMPLETED',
      startedAt: new Date(),
      completedAt: new Date(),
    },
    update: {
      status: 'COMPLETED',
      completedAt: new Date(),
      lastViewedAt: new Date(),
    },
  })

  await recalculateCourseProgress(session.user.id, String(courseId))

  revalidatePath(`/courses/${courseSlug}/lessons/${lessonId}`)
  revalidatePath(`/courses/${courseSlug}`)
  revalidatePath('/dashboard')

  return { success: true }
}

/**
 * Check if all tasks in a lesson have been submitted.
 * If yes, mark the lesson as COMPLETED.
 * Exported so submit-task.ts can call it after recording an answer.
 */
export async function checkLessonCompletion(userId: string, lessonId: string, userRole?: string) {
  const payload = await getPayload({ config })

  const tasksWhere: any = isStaffRole(userRole)
    ? { lesson: { equals: lessonId } }
    : { lesson: { equals: lessonId }, isPublished: { equals: true } }

  const { docs: tasks } = await payload.find({
    collection: 'tasks',
    where: tasksWhere,
  })

  const totalTasks = tasks.length

  if (totalTasks === 0) {
    return // No tasks — require manual completion
  }

  const submittedTasks = await prisma.taskProgress.count({
    where: {
      userId,
      taskId: { in: tasks.map((t) => String(t.id)) },
      status: { in: ['ATTEMPTED', 'PASSED'] },
    },
  })

  if (submittedTasks === totalTasks) {
    await prisma.lessonProgress.updateMany({
      where: { userId, lessonId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    })
  }
}
