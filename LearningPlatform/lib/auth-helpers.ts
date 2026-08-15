import { auth } from '@/auth'
import type { Role } from '@prisma/client'
import { isStaffRole, isManagerRole, isPresidentRole } from '@/lib/roles'

export type SessionUser = {
  id: string
  email: string
  name?: string | null
  role: Role
  isPro: boolean
}

export async function requireAuth(): Promise<SessionUser> {
  const session = await auth()
  if (!session?.user?.id || !session.user.email || !session.user.role) {
    throw new Error('Unauthorized')
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    isPro: session.user.isPro === true,
  }
}

export async function requireProUser(): Promise<SessionUser> {
  const user = await requireAuth()
  if (!user.isPro) {
    throw new Error('Forbidden')
  }
  return user
}

/** Any staff member (Trainer, Manager, or President) — can reach the admin panel. */
export async function requireStaff(): Promise<SessionUser> {
  const user = await requireAuth()
  if (!isStaffRole(user.role)) {
    throw new Error('Forbidden')
  }
  return user
}

/**
 * Manager or President — can manage content and users.
 * `requireAdmin` is kept as an alias so existing management endpoints keep
 * their previous (now Manager+) gate without a wide rename.
 */
export async function requireManager(): Promise<SessionUser> {
  const user = await requireAuth()
  if (!isManagerRole(user.role)) {
    throw new Error('Forbidden')
  }
  return user
}

export const requireAdmin = requireManager

/** President only — the top tier that can assign roles. */
export async function requirePresident(): Promise<SessionUser> {
  const user = await requireAuth()
  if (!isPresidentRole(user.role)) {
    throw new Error('Forbidden')
  }
  return user
}
