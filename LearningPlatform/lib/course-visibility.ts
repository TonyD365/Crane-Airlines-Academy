/**
 * Group-based course visibility.
 *
 * Courses (Payload) carry a `publishGroupIds` JSON array of Prisma `Group` ids.
 * Semantics:
 *   - empty / missing  → visible to every student (all groups)
 *   - non-empty        → visible only to students whose group id is in the list
 *
 * Admins always see everything and are exempt from this check.
 */

import { prisma } from '@/lib/prisma'

/** Normalise a course's `publishGroupIds` field into a string[]. */
export function extractPublishGroupIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string' && v.length > 0)
}

/** Whether a course with the given publish groups is visible to `groupId`. */
export function courseVisibleToGroup(
  publishGroupIds: unknown,
  groupId: string | null | undefined,
): boolean {
  const ids = extractPublishGroupIds(publishGroupIds)
  if (ids.length === 0) return true // published to all groups
  if (!groupId) return false // restricted course, student has no group
  return ids.includes(groupId)
}

/** Fetch the current user's group id (or null). */
export async function getUserGroupId(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { groupId: true },
    })
    return user?.groupId ?? null
  } catch {
    return null
  }
}
