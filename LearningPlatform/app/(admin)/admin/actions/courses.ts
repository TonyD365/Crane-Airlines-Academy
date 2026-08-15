'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAdmin } from '@/lib/auth-helpers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { courseFormSchema } from '../schemas'
import { payloadTableExists } from '@/lib/payload-utils'
import { timeAsync } from '@/lib/utils'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { logActivity, ActivityAction } from '@/lib/activity-log'

export async function getCourses() {
  await requireAdmin()

  // Check if Payload tables exist before querying
  const tableExists = await payloadTableExists('courses')
  if (!tableExists) {
    throw new Error('Payload tables not initialized. Please run: npm run payload:migrate')
  }

  const payload = await getPayload({ config })

  const { result } = await timeAsync('admin:courses', () =>
    payload.find({
      collection: 'courses',
      limit: 100,
      sort: '-updatedAt',
    })
  )
  const { docs } = result

  return docs
}

export async function getCourseById(id: string) {
  await requireAdmin()
  const payload = await getPayload({ config })

  const course = await payload.findByID({
    collection: 'courses',
    id,
    depth: 1,
  })

  return course
}

export async function createCourse(data: z.infer<typeof courseFormSchema>) {
  const admin = await requireAdmin()
  const validated = courseFormSchema.parse(data)
  const payload = await getPayload({ config })

  const { coverImage, ...rest } = validated
  const cover =
    typeof coverImage === 'string' && coverImage.length > 0 ? { coverImage } : {}

  const course = await payload.create({
    collection: 'courses',
    data: {
      ...rest,
      ...cover,
      // Store subject as string id (payload uses varchar/uuid ids)
      subject: validated.subject ? String(validated.subject) : undefined,
      isPublished: false,
      publishGroupIds: validated.publishGroupIds ?? [],
      lastUpdatedBy: admin.email ?? undefined,
      createdVia: 'admin',
    },
  })

  logActivity({
    action:       ActivityAction.COURSE_CREATED,
    actorUserId:  admin.id,
    actorEmail:   admin.email,
    resourceType: 'course',
    resourceId:   String(course.id),
    metadata:     { title: course.title },
  })

  revalidatePath('/admin/dashboard')
  return course
}

export async function updateCourse(
  id: string,
  data: Partial<z.infer<typeof courseFormSchema>> & { coverImage?: string | null },
) {
  const admin = await requireAdmin()
  const payload = await getPayload({ config })

  const payloadData: Record<string, unknown> = { ...data }
  if (data.coverImage === '') {
    payloadData.coverImage = null
  }

  const course = await payload.update({
    collection: 'courses',
    id,
    data: {
      ...payloadData,
      lastUpdatedBy: admin.email ?? undefined,
    },
  })

  logActivity({
    action:       ActivityAction.COURSE_UPDATED,
    actorUserId:  admin.id,
    actorEmail:   admin.email,
    resourceType: 'course',
    resourceId:   String(id),
    metadata:     { title: course.title },
  })

  revalidatePath('/admin/dashboard')
  return course
}

export async function toggleCoursePublish(id: string, isPublished: boolean) {
  const admin = await requireAdmin()
  const payload = await getPayload({ config })

  const course = await payload.update({
    collection: 'courses',
    id,
    data: { isPublished, lastUpdatedBy: admin.email ?? undefined },
  })

  logActivity({
    action:       isPublished ? ActivityAction.COURSE_PUBLISHED : ActivityAction.COURSE_UNPUBLISHED,
    actorUserId:  admin.id,
    actorEmail:   admin.email,
    resourceType: 'course',
    resourceId:   String(id),
    metadata:     { title: course.title },
  })

  revalidatePath('/admin/dashboard')
  return course
}

/**
 * Publish the course and every module, lesson, and task belonging to it (full tree).
 * Idempotent: already-published items are left as-is.
 */
export async function publishCourseTree(courseId: string) {
  const admin = await requireAdmin()
  const payload = await getPayload({ config })

  const course = await payload.findByID({
    collection: 'courses',
    id: String(courseId),
  })
  if (!course) {
    throw new Error('Course not found')
  }

  const { docs: modules } = await payload.find({
    collection: 'modules',
    where: { course: { equals: String(courseId) } },
    limit: 500,
  })

  const { docs: lessons } = await payload.find({
    collection: 'lessons',
    where: { course: { equals: String(courseId) } },
    limit: 5000,
  })

  const lessonIds = lessons.map((l) => String(l.id))

  let tasks: { id: string | number; isPublished?: boolean }[] = []
  if (lessonIds.length > 0) {
    const taskResult = await payload.find({
      collection: 'tasks',
      where: { lesson: { in: lessonIds } },
      limit: 10000,
    })
    tasks = taskResult.docs
  }

  let modulesUpdated = 0
  for (const m of modules) {
    if (!m.isPublished) {
      await payload.update({
        collection: 'modules',
        id: String(m.id),
        data: { isPublished: true },
      })
      modulesUpdated += 1
    }
  }

  let lessonsUpdated = 0
  for (const l of lessons) {
    if (!l.isPublished) {
      await payload.update({
        collection: 'lessons',
        id: String(l.id),
        data: { isPublished: true },
      })
      lessonsUpdated += 1
    }
  }

  let tasksUpdated = 0
  for (const t of tasks) {
    if (!t.isPublished) {
      await payload.update({
        collection: 'tasks',
        id: String(t.id),
        data: { isPublished: true },
      })
      tasksUpdated += 1
    }
  }

  if (!course.isPublished) {
    await payload.update({
      collection: 'courses',
      id: String(courseId),
      data: { isPublished: true, lastUpdatedBy: admin.email ?? undefined },
    })
  }

  logActivity({
    action: ActivityAction.COURSE_TREE_PUBLISHED,
    actorUserId: admin.id,
    actorEmail: admin.email,
    resourceType: 'course',
    resourceId: String(courseId),
    metadata: {
      title: course.title,
      modules: modules.length,
      lessons: lessons.length,
      tasks: tasks.length,
      tasksUpdated,
      lessonsUpdated,
      modulesUpdated,
    },
  })

  revalidatePath('/admin/dashboard')
  revalidatePath('/admin/lessons')
  revalidatePath(`/admin/courses/${courseId}/edit`)
  revalidatePath('/courses')
  if (typeof course.slug === 'string' && course.slug) {
    revalidatePath(`/courses/${course.slug}`)
  }

  return {
    modules: modules.length,
    lessons: lessons.length,
    tasks: tasks.length,
    modulesUpdated,
    lessonsUpdated,
    tasksUpdated,
  }
}

export async function deleteCourse(id: string) {
  const admin = await requireAdmin()
  const payload = await getPayload({ config })

  try {
    // 1. Find all modules in this course
    const { docs: modules } = await payload.find({
      collection: 'modules',
      where: { course: { equals: id } },
    })

    const moduleIds = modules.map(m => String(m.id))

    // 2. Find all lessons for these modules
    const { docs: lessons } = await payload.find({
      collection: 'lessons',
      where: { module: { in: moduleIds } },
    })

    const lessonIds = lessons.map(l => String(l.id))

    // 3. Find all tasks for these lessons
    const { docs: tasks } = await payload.find({
      collection: 'tasks',
      where: { lesson: { in: lessonIds } },
    })

    const taskIds = tasks.map(t => String(t.id))

    // Delete all Prisma progress records first to avoid orphaned records
    logger.info(`Deleting progress records for course ${id}...`)

    if (taskIds.length > 0) {
      const deletedTasks = await prisma.taskProgress.deleteMany({
        where: { taskId: { in: taskIds } },
      })
      logger.info(`Deleted ${deletedTasks.count} task progress records`)
    }

    if (lessonIds.length > 0) {
      const deletedLessons = await prisma.lessonProgress.deleteMany({
        where: { lessonId: { in: lessonIds } },
      })
      logger.info(`Deleted ${deletedLessons.count} lesson progress records`)
    }

    const deletedCourse = await prisma.courseProgress.deleteMany({
      where: { courseId: id },
    })
    logger.info(`Deleted ${deletedCourse.count} course progress records`)

    // Now safe to delete Payload CMS records
    logger.info(`Deleting Payload CMS records for course ${id}...`)

    for (const task of tasks) {
      await payload.delete({ collection: 'tasks', id: String(task.id) })
    }
    logger.info(`Deleted ${tasks.length} tasks`)

    for (const lesson of lessons) {
      await payload.delete({ collection: 'lessons', id: String(lesson.id) })
    }
    logger.info(`Deleted ${lessons.length} lessons`)

    for (const courseModule of modules) {
      await payload.delete({ collection: 'modules', id: String(courseModule.id) })
    }
    logger.info(`Deleted ${modules.length} modules`)

    await payload.delete({ collection: 'courses', id: String(id) })

    logActivity({
      action:       ActivityAction.COURSE_DELETED,
      actorUserId:  admin.id,
      actorEmail:   admin.email,
      resourceType: 'course',
      resourceId:   String(id),
    })

    revalidatePath('/admin/dashboard')
    logger.info(`Course ${id} deleted successfully`)
  } catch (error) {
    logger.error('Failed to delete course', { error })
    throw new Error(`Failed to delete course: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
