/**
 * Cross-schema document validation utilities.
 *
 * Problem: PostgreSQL cannot enforce foreign keys across schemas managed by
 * different owners (public → Prisma, payload → Payload CMS).  References such
 * as LessonProgress.lessonId and TaskProgress.taskId are plain Text columns
 * with no DB-level constraint.
 *
 * Solution: any code path that creates a Prisma progress record that references
 * a Payload CMS document MUST call requirePayloadDocument() first.  If the
 * document does not exist (or is unpublished for non-admin callers), this
 * function throws before the insert, preventing orphaned rows.
 *
 * These helpers are also used by lesson-progress.ts and submit-task.ts.
 * Adding them here makes the validation contract explicit, reusable, and easy
 * to audit in code review.
 */

import { getPayload } from 'payload'
import config from '@payload-config'
import { isStaffRole } from '@/lib/roles'

export type PayloadCollection = 'lessons' | 'tasks' | 'courses' | 'modules'

/**
 * Verify that a Payload CMS document exists and is accessible to the caller.
 *
 * @param collection - Payload CMS collection slug
 * @param id         - Document ID to look up
 * @param role       - Caller's role string.  Admins bypass the isPublished check.
 * @returns          The document record (typed loosely to avoid importing Payload
 *                   generics that are incompatible with strict tsc settings).
 * @throws           Error('collection not found: id') when the document is absent
 *                   or unpublished for a non-admin caller.
 */
export async function requirePayloadDocument(
  collection: PayloadCollection,
  id: string,
  role?: string,
): Promise<Record<string, unknown>> {
  const payload = await getPayload({ config })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc: any = await payload.findByID({ collection, id })

  if (!doc) {
    const singular = collection.replace(/s$/, '')
    const pretty = singular.charAt(0).toUpperCase() + singular.slice(1)
    throw new Error(`${pretty} not found`)
  }

  if (!doc.isPublished && !isStaffRole(role)) {
    const singular = collection.replace(/s$/, '')
    const pretty = singular.charAt(0).toUpperCase() + singular.slice(1)
    throw new Error(`${pretty} not found`)
  }

  return doc as Record<string, unknown>
}
