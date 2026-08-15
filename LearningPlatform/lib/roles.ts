/**
 * Role hierarchy helpers — pure, dependency-free so they are safe to import from
 * middleware (edge runtime), client components, and server code alike.
 *
 * Tiers (highest to lowest):
 *   PRESIDENT — top admin, can do everything (content, users, roles, groups, all completion).
 *   MANAGER   — can manage content and users (create accounts, groups, Pro) and view all
 *               student completion, but CANNOT change anyone's role / admin level.
 *   TRAINER   — read-only; can only view the course completion of students in their own group.
 *   STUDENT   — regular learner, no admin access.
 */

export type AppRole = 'STUDENT' | 'TRAINER' | 'MANAGER' | 'PRESIDENT'

/** Roles that can access the admin panel at all. */
export const STAFF_ROLES = ['TRAINER', 'MANAGER', 'PRESIDENT'] as const
/** Roles that can manage content and users (everything except role assignment). */
export const MANAGER_ROLES = ['MANAGER', 'PRESIDENT'] as const
/** Roles that can be assigned to a user. */
export const ASSIGNABLE_ROLES = ['STUDENT', 'TRAINER', 'MANAGER', 'PRESIDENT'] as const

export const ROLE_LABEL: Record<string, string> = {
  STUDENT: 'Student',
  TRAINER: 'Trainer',
  MANAGER: 'Manager',
  PRESIDENT: 'President',
}

/** Any admin-panel role (not a plain student). */
export function isStaffRole(role?: string | null): boolean {
  return role === 'TRAINER' || role === 'MANAGER' || role === 'PRESIDENT'
}

/** Can manage content and users (Manager or President). */
export function isManagerRole(role?: string | null): boolean {
  return role === 'MANAGER' || role === 'PRESIDENT'
}

/** Top admin only. */
export function isPresidentRole(role?: string | null): boolean {
  return role === 'PRESIDENT'
}
