import { NextResponse } from 'next/server'
import { z } from 'zod'
import { Role } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-helpers'
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
    const admin = await requireAdmin()
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

    if (parsed.data.role === Role.STUDENT && id === admin.id) {
      return NextResponse.json({ error: 'You cannot remove your own admin role' }, { status: 403 })
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
