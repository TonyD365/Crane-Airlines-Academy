import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import type { Prisma } from '@prisma/client'
import { getActivityLoggingEnabled } from '@/lib/platform-flags'

export const ActivityAction = {
  USER_REGISTERED:     'USER_REGISTERED',
  USER_LOGIN:          'USER_LOGIN',
  USER_LOGOUT:         'USER_LOGOUT',
  COURSE_CREATED:      'COURSE_CREATED',
  COURSE_UPDATED:      'COURSE_UPDATED',
  COURSE_PUBLISHED:    'COURSE_PUBLISHED',
  COURSE_UNPUBLISHED:  'COURSE_UNPUBLISHED',
  /** Course + every module, lesson, and task in the tree set to published */
  COURSE_TREE_PUBLISHED: 'COURSE_TREE_PUBLISHED',
  COURSE_DELETED:      'COURSE_DELETED',
  MODULE_CREATED:      'MODULE_CREATED',
  MODULE_UPDATED:      'MODULE_UPDATED',
  MODULE_DELETED:      'MODULE_DELETED',
  LESSON_CREATED:      'LESSON_CREATED',
  LESSON_UPDATED:      'LESSON_UPDATED',
  LESSON_DELETED:      'LESSON_DELETED',
  TASK_CREATED:        'TASK_CREATED',
  TASK_UPDATED:        'TASK_UPDATED',
  TASK_DELETED:        'TASK_DELETED',
  FLASHCARD_CREATED:   'FLASHCARD_CREATED',
  FLASHCARD_UPDATED:   'FLASHCARD_UPDATED',
  FLASHCARD_DELETED:   'FLASHCARD_DELETED',
  MODULE_PUBLISHED:    'MODULE_PUBLISHED',
  MODULE_UNPUBLISHED:  'MODULE_UNPUBLISHED',
  LESSON_PUBLISHED:    'LESSON_PUBLISHED',
  LESSON_UNPUBLISHED:  'LESSON_UNPUBLISHED',
  TAG_CREATED:         'TAG_CREATED',
  TAG_UPDATED:         'TAG_UPDATED',
  TAG_DELETED:         'TAG_DELETED',
  SUBJECT_CREATED:     'SUBJECT_CREATED',
  SUBJECT_UPDATED:     'SUBJECT_UPDATED',
  SUBJECT_DELETED:     'SUBJECT_DELETED',
  MEDIA_UPLOADED:      'MEDIA_UPLOADED',
  MEDIA_DELETED:       'MEDIA_DELETED',
  USER_LOGIN_FAILED:   'USER_LOGIN_FAILED',
  /** Pro user invoked the lesson AI assistant (metadata: lessonId, courseSlug, modelPreset). */
  USER_PRO_LESSON_ASSISTANT: 'USER_PRO_LESSON_ASSISTANT',
  /** Admin changed a user's Pro flag (metadata: targetUserId, isPro). */
  ADMIN_USER_PRO_UPDATED: 'ADMIN_USER_PRO_UPDATED',
  /** Admin changed a user's role (metadata: targetUserId, role). */
  ADMIN_USER_ROLE_UPDATED: 'ADMIN_USER_ROLE_UPDATED',
  /** Admin created a user account (metadata: targetUserId, username, role). */
  ADMIN_USER_CREATED: 'ADMIN_USER_CREATED',
  /** Admin deleted a user account (metadata: targetUserId, username, role). */
  ADMIN_USER_DELETED: 'ADMIN_USER_DELETED',
  /** Admin changed a user's group (metadata: targetUserId, groupId). */
  ADMIN_USER_GROUP_UPDATED: 'ADMIN_USER_GROUP_UPDATED',
  /** Admin created a student group (metadata: groupId, name). */
  ADMIN_GROUP_CREATED: 'ADMIN_GROUP_CREATED',
  /** Admin renamed a student group (metadata: groupId, name). */
  ADMIN_GROUP_UPDATED: 'ADMIN_GROUP_UPDATED',
  /** Admin deleted a student group (metadata: groupId). */
  ADMIN_GROUP_DELETED: 'ADMIN_GROUP_DELETED',
} as const

export type ActivityActionType = (typeof ActivityAction)[keyof typeof ActivityAction]

export interface LogActivityParams {
  action: ActivityActionType
  actorUserId?: string | null
  actorEmail?: string | null
  resourceType?: string | null
  resourceId?: string | null
  metadata?: Record<string, unknown> | null
}

/**
 * Records a platform activity log entry in a fire-and-forget manner.
 * Any persistence failure is silently swallowed so that logging never
 * interrupts the primary operation.
 */
export function logActivity(params: LogActivityParams): void {
  void getActivityLoggingEnabled()
    .catch(() => true)
    .then((enabled) => {
      if (!enabled) return
      return prisma.activityLog
        .create({
          data: {
            action:       params.action,
            actorUserId:  params.actorUserId  ?? null,
            actorEmail:   params.actorEmail   ?? null,
            resourceType: params.resourceType ?? null,
            resourceId:   params.resourceId   ?? null,
            metadata:     params.metadata != null
                            ? (params.metadata as Prisma.InputJsonValue)
                            : undefined,
          },
        })
        .catch((err: unknown) =>
          logger.warning('Failed to write activity log', { err: String(err) })
        )
    })
}
