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
  console.error('[api/admin/groups]', error)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

export async function GET() {
  try {
    await requireAdmin()

    const groups = await prisma.group.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: { select: { members: true } },
      },
    })

    const shaped = groups.map((g) => ({
      id: g.id,
      name: g.name,
      createdAt: g.createdAt,
      memberCount: g._count.members,
    }))

    return NextResponse.json(
      { groups: shaped },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    return handleError(error)
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
})

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin()

    let json: unknown
    try {
      json = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const parsed = createSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    const name = parsed.data.name
    const existing = await prisma.group.findUnique({ where: { name } })
    if (existing) {
      return NextResponse.json({ error: 'A group with that name already exists' }, { status: 409 })
    }

    const group = await prisma.group.create({ data: { name } })

    logActivity({
      action: ActivityAction.ADMIN_GROUP_CREATED,
      actorUserId: admin.id,
      actorEmail: admin.email,
      resourceType: 'group',
      resourceId: group.id,
      metadata: { groupId: group.id, name: group.name },
    })

    return NextResponse.json(
      { id: group.id, name: group.name, createdAt: group.createdAt, memberCount: 0 },
      { status: 201 },
    )
  } catch (error) {
    return handleError(error)
  }
}
