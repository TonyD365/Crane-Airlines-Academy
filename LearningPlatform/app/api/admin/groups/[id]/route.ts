import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-helpers'
import { logActivity, ActivityAction } from '@/lib/activity-log'

function handleError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }
  console.error('[api/admin/groups/[id]]', error)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

const patchSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
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

    const exists = await prisma.group.findUnique({ where: { id }, select: { id: true } })
    if (!exists) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const clash = await prisma.group.findUnique({ where: { name: parsed.data.name } })
    if (clash && clash.id !== id) {
      return NextResponse.json({ error: 'A group with that name already exists' }, { status: 409 })
    }

    const group = await prisma.group.update({ where: { id }, data: { name: parsed.data.name } })

    logActivity({
      action: ActivityAction.ADMIN_GROUP_UPDATED,
      actorUserId: admin.id,
      actorEmail: admin.email,
      resourceType: 'group',
      resourceId: id,
      metadata: { groupId: id, name: group.name },
    })

    return NextResponse.json({ id: group.id, name: group.name })
  } catch (error) {
    return handleError(error)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin()
    const { id } = await params

    const exists = await prisma.group.findUnique({ where: { id }, select: { id: true } })
    if (!exists) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Members' `groupId` is cleared automatically via `onDelete: SetNull`.
    await prisma.group.delete({ where: { id } })

    logActivity({
      action: ActivityAction.ADMIN_GROUP_DELETED,
      actorUserId: admin.id,
      actorEmail: admin.email,
      resourceType: 'group',
      resourceId: id,
      metadata: { groupId: id },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleError(error)
  }
}
