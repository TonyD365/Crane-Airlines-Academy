'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAdmin } from '@/lib/auth-helpers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { taskFormSchema } from '../schemas'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { logActivity, ActivityAction } from '@/lib/activity-log'
import { ensureTaskIdDefaults } from '@/lib/ensure-task-id-defaults'

export async function getTasksByLesson(lessonId: string) {
  await requireAdmin()
  const payload = await getPayload({ config })

  const { docs } = await payload.find({
    collection: 'tasks',
    where: { lesson: { equals: lessonId } },
    sort: 'order',
  })

  return docs
}

export async function createTask(data: z.infer<typeof taskFormSchema>) {
  try {
    const admin = await requireAdmin()
    const validated = taskFormSchema.parse(data)
    const payload = await getPayload({ config })

    // Ensure the tasks/tasks_choices primary keys have a working default before
    // inserting (production DB never had the migration applied).
    await ensureTaskIdDefaults()

    // Transform choices array to Payload format
    const choicesForPayload = validated.choices
      ? validated.choices.map(text => ({ text }))
      : undefined

    // Convert media IDs to strings for database column type
    const questionMediaStr = validated.questionMedia ? String(validated.questionMedia) : undefined
    const solutionMediaStr = validated.solutionMedia ? String(validated.solutionMedia) : undefined

    // Auto-generate title from prompt plain text if not supplied by caller
    const promptText = (() => {
      const p = validated.prompt as any
      const texts: string[] = []
      function walk(n: any) {
        if (n?.text) texts.push(n.text)
        if (Array.isArray(n?.children)) n.children.forEach(walk)
      }
      walk(p?.root)
      return texts.join(' ').slice(0, 120) || undefined
    })()
    const taskTitle = validated.title || promptText || `Task (${validated.type})`

    const task = await payload.create({
      collection: 'tasks',
      data: {
        ...(validated.lesson?.length ? { lesson: validated.lesson } : {}),
        title: taskTitle,
        type: validated.type,
        prompt: validated.prompt,
        questionMedia: questionMediaStr,
        choices: choicesForPayload,
        correctAnswer: validated.correctAnswer,
        solution: validated.solution,
        solutionMedia: solutionMediaStr,
        solutionVideoUrl: validated.solutionVideoUrl || undefined,
        points: validated.points,
        order: validated.order,
        autoGrade: !!validated.autoGrade,
        isPublished: false,
        ...(validated.tags && validated.tags.length > 0
          ? { tags: validated.tags.map(({ id, name, slug }) => ({ tagId: id, name, slug })) }
          : {}),
      },
    })

    if (data.lesson?.length) {
      for (const id of data.lesson) {
        revalidatePath(`/admin/lessons/${id}/builder`)
      }
    }
    logActivity({
      action:       ActivityAction.TASK_CREATED,
      actorUserId:  admin.id,
      actorEmail:   admin.email,
      resourceType: 'task',
      resourceId:   String(task.id),
      metadata:     { title: taskTitle, type: validated.type },
    })
    revalidatePath('/admin/tasks')
    return task
  } catch (error) {
    logger.error('createTask error', { error })

    if (error instanceof z.ZodError) {
      throw new Error(`Validation failed: ${error.issues.map((e: any) => e.message).join(', ')}`)
    }

    if (error && typeof error === 'object' && 'message' in error) {
      const message = String((error as { message: string }).message)

      if (message.includes('null value in column')) {
        const match = message.match(/column "(\w+)"/)
        const column = match ? match[1] : 'a required field'
        throw new Error(`Missing required field: ${column}`)
      }

      if (message.includes('foreign key constraint')) {
        throw new Error('Invalid reference to lesson or media')
      }

      throw new Error(`Failed to create task: ${message}`)
    }

    throw new Error('An unexpected error occurred while creating the task')
  }
}

export async function updateTask(id: string, data: Partial<z.infer<typeof taskFormSchema>>) {
  const admin = await requireAdmin()
  const payload = await getPayload({ config })

  const validated = taskFormSchema.partial().parse(data)

  const updateData: Record<string, unknown> = { ...validated }
  if (validated.choices) {
    updateData.choices = validated.choices.map(text => ({ text }))
  }
  if (validated.tags) {
    updateData.tags = validated.tags.map(({ id, name, slug }) => ({ tagId: id, name, slug }))
  }

  // Convert media IDs to strings for database column type
  if (validated.questionMedia !== undefined) {
    updateData.questionMedia = validated.questionMedia ? String(validated.questionMedia) : undefined
  }
  if (validated.solutionMedia !== undefined) {
    updateData.solutionMedia = validated.solutionMedia ? String(validated.solutionMedia) : undefined
  }

  const task = await payload.update({
    collection: 'tasks',
    id,
    data: updateData,
  })

  logActivity({
    action:       ActivityAction.TASK_UPDATED,
    actorUserId:  admin.id,
    actorEmail:   admin.email,
    resourceType: 'task',
    resourceId:   String(id),
    metadata:     { title: task.title },
  })

  revalidatePath('/admin/lessons')
  revalidatePath('/admin/tasks')
  return task
}

export async function deleteTask(id: string) {
  const admin = await requireAdmin()
  const payload = await getPayload({ config })

  try {
    // Delete all Prisma progress records first
    logger.info(`Deleting progress records for task ${id}...`)

    const deletedTasks = await prisma.taskProgress.deleteMany({
      where: { taskId: id },
    })
    logger.info(`Deleted ${deletedTasks.count} task progress records`)

    // Now safe to delete the Payload CMS task
    await payload.delete({ collection: 'tasks', id })

    logActivity({
      action:       ActivityAction.TASK_DELETED,
      actorUserId:  admin.id,
      actorEmail:   admin.email,
      resourceType: 'task',
      resourceId:   String(id),
    })

    revalidatePath('/admin/lessons')
    revalidatePath('/admin/tasks')
    logger.info(`Task ${id} deleted successfully`)
  } catch (error) {
    logger.error('Failed to delete task', { error })
    throw new Error(`Failed to delete task: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Assign a task to zero or more lessons.
 * Pass an empty array to make the task standalone (no lessons).
 */
export async function assignTask(taskId: string, lessonIds: string[]) {
  await requireAdmin()
  const payload = await getPayload({ config })

  await payload.update({
    collection: 'tasks',
    id: taskId,
    data: { lesson: lessonIds.length ? lessonIds : undefined },
  })

  revalidatePath('/admin/tasks')
  revalidatePath('/admin/lessons')
}
