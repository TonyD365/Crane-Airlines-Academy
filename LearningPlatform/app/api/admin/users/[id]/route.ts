import { NextResponse } from 'next/server'
import { z } from 'zod'
import { Role } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireStaff, requireManager } from '@/lib/auth-helpers'
import { isManagerRole, isPresidentRole, isStaffRole } from '@/lib/roles'
import { logActivity, ActivityAction } from '@/lib/activity-log'

const patchSchema = z
  .object({
    isPro: z.boolean().optional(),
    role: z.nativeEnum(Role).optional(),
    // `null` clears the user's group; a string sets it; omitted leaves it unchanged.
    groupId: z.string().min(1).nullable().optional(),
  })
  .refine((d) => d.isPro !== undefined || d.role !== undefined || d.groupId !== undefined, {
    message: 'Provide isPro, role, and/or groupId',
  })

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Any staff may edit a student's group; Pro requires Manager+, role requires President.
    const admin = await requireStaff()
    const { id } = await params

    let json: unknown
    try {
      json = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const parsed = patchSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    const exists = await prisma.user.findUnique({ where: { id }, select: { id: true } })
    if (!exists) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Pro access is a Manager+ action.
    if (parsed.data.isPro !== undefined && !isManagerRole(admin.role)) {
      return NextResponse.json(
        { error: 'Only a Manager or President can change Pro access' },
        { status: 403 },
      )
    }

    // Only the President may change roles (admin levels).
    if (parsed.data.role !== undefined && !isPresidentRole(admin.role)) {
      return NextResponse.json(
        { error: 'Only a President can change a user’s role' },
        { status: 403 },
      )
    }

    // Prevent a President from demoting themselves and losing top access.
    if (parsed.data.role !== undefined && id === admin.id && parsed.data.role !== Role.PRESIDENT) {
      return NextResponse.json({ error: 'You cannot lower your own role' }, { status: 403 })
    }

    if (parsed.data.groupId) {
      const group = await prisma.group.findUnique({
        where: { id: parsed.data.groupId },
        select: { id: true },
      })
      if (!group) {
        return NextResponse.json({ error: 'Selected group does not exist' }, { status: 400 })
      }
    }

    const data: { isPro?: boolean; role?: Role; groupId?: string | null } = {}
    if (parsed.data.isPro !== undefined) data.isPro = parsed.data.isPro
    if (parsed.data.role !== undefined) data.role = parsed.data.role
    if (parsed.data.groupId !== undefined) data.groupId = parsed.data.groupId

    await prisma.user.update({
      where: { id },
      data,
    })

    if (parsed.data.isPro !== undefined) {
      logActivity({
        action: ActivityAction.ADMIN_USER_PRO_UPDATED,
        actorUserId: admin.id,
        actorEmail: admin.email,
        resourceType: 'user',
        resourceId: id,
        metadata: { targetUserId: id, isPro: parsed.data.isPro },
      })
    }
    if (parsed.data.role !== undefined) {
      logActivity({
        action: ActivityAction.ADMIN_USER_ROLE_UPDATED,
        actorUserId: admin.id,
        actorEmail: admin.email,
        resourceType: 'user',
        resourceId: id,
        metadata: { targetUserId: id, role: parsed.data.role },
      })
    }
    if (parsed.data.groupId !== undefined) {
      logActivity({
        action: ActivityAction.ADMIN_USER_GROUP_UPDATED,
        actorUserId: admin.id,
        actorEmail: admin.email,
        resourceType: 'user',
        resourceId: id,
        metadata: { targetUserId: id, groupId: parsed.data.groupId },
      })
    }

    return NextResponse.json({
      ok: true,
      ...(parsed.data.isPro !== undefined ? { isPro: parsed.data.isPro } : {}),
      ...(parsed.data.role !== undefined ? { role: parsed.data.role } : {}),
      ...(parsed.data.groupId !== undefined ? { groupId: parsed.data.groupId } : {}),
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message === 'Forbidden') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
    console.error('[PATCH /api/admin/users/[id]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Delete a user. Manager+ action. Managers may not delete other staff
 * (Manager/President) — that is effectively role management, reserved for the
 * President. Nobody may delete themselves. Related progress rows cascade.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireManager()
    const { id } = await params

    if (id === admin.id) {
      return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 403 })
    }

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, username: true },
    })
    if (!target) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Managers may only delete students; removing any staff account (Trainer,
    // Manager, President) is a permission-level action reserved for the President.
    if (isStaffRole(target.role) && !isPresidentRole(admin.role)) {
      return NextResponse.json(
        { error: 'Only a President can delete a staff account' },
        { status: 403 },
      )
    }

    await prisma.user.delete({ where: { id } })

    logActivity({
      action: ActivityAction.ADMIN_USER_DELETED,
      actorUserId: admin.id,
      actorEmail: admin.email,
      resourceType: 'user',
      resourceId: id,
      metadata: { targetUserId: id, username: target.username, role: target.role },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message === 'Forbidden') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
    console.error('[DELETE /api/admin/users/[id]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
