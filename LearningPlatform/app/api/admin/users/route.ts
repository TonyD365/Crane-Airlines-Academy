import { NextResponse } from 'next/server'
import { z } from 'zod'
import { Role } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin, requireManager } from '@/lib/auth-helpers'
import { isPresidentRole } from '@/lib/roles'
import { logActivity, ActivityAction } from '@/lib/activity-log'

export async function GET(req: Request) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1)
    const rawLimit = Number.parseInt(searchParams.get('limit') || '20', 10) || 20
    const limit = Math.min(100, Math.max(1, rawLimit))
    const skip = (page - 1) * limit

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          rbxUserId: true,
          username: true,
          name: true,
          role: true,
          isPro: true,
          createdAt: true,
          groupId: true,
          group: { select: { id: true, name: true } },
        },
      }),
      prisma.user.count(),
    ])

    return NextResponse.json(
      { users, total, page, limit },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message === 'Forbidden') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
    console.error('[GET /api/admin/users]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Create a new account. Admin-only — public self-service registration is
 * disabled. Users sign in with Roblox (RBX) OAuth; the account is matched by
 * the Roblox numeric user id, so the admin must supply the person's RBX UserID
 * and username when creating the account.
 */
const createUserSchema = z.object({
  // Roblox numeric user id (the OAuth "sub"). Digits only.
  rbxUserId: z
    .string()
    .trim()
    .min(1, 'RBX UserID is required')
    .max(32)
    .regex(/^[0-9]+$/, 'RBX UserID must be a number'),
  // RBX usernames: letters, digits, and underscores are the common set.
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(32)
    .regex(/^[A-Za-z0-9_]+$/, 'Username may only contain letters, numbers, and underscores'),
  name: z.string().trim().max(100).optional(),
  role: z.nativeEnum(Role).optional(),
  groupId: z.string().min(1).nullable().optional(),
})

export async function POST(req: Request) {
  try {
    const admin = await requireManager()

    let json: unknown
    try {
      json = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const parsed = createUserSchema.safeParse(json)
    if (!parsed.success) {
      const first = parsed.error.issues[0]?.message ?? 'Invalid data'
      return NextResponse.json({ error: first }, { status: 400 })
    }

    const { name, role, groupId } = parsed.data

    // Only a President may create staff accounts; Managers can create students only.
    const requestedRole = role ?? Role.STUDENT
    if (requestedRole !== Role.STUDENT && !isPresidentRole(admin.role)) {
      return NextResponse.json(
        { error: 'Only a President can create Trainer, Manager, or President accounts' },
        { status: 403 },
      )
    }

    const rbxUserId = parsed.data.rbxUserId
    const username = parsed.data.username

    const existing = await prisma.user.findFirst({
      where: { OR: [{ rbxUserId }, { username }] },
      select: { rbxUserId: true, username: true },
    })
    if (existing) {
      const clash = existing.rbxUserId === rbxUserId ? 'RBX UserID' : 'username'
      return NextResponse.json({ error: `That ${clash} is already registered` }, { status: 409 })
    }

    if (groupId) {
      const group = await prisma.group.findUnique({ where: { id: groupId }, select: { id: true } })
      if (!group) {
        return NextResponse.json({ error: 'Selected group does not exist' }, { status: 400 })
      }
    }

    const user = await prisma.user.create({
      data: {
        rbxUserId,
        username,
        name: name?.trim() || null,
        role: requestedRole,
        groupId: groupId ?? null,
      },
      select: {
        id: true,
        rbxUserId: true,
        username: true,
        name: true,
        role: true,
        isPro: true,
        createdAt: true,
        groupId: true,
        group: { select: { id: true, name: true } },
      },
    })

    logActivity({
      action: ActivityAction.ADMIN_USER_CREATED,
      actorUserId: admin.id,
      actorEmail: admin.email,
      resourceType: 'user',
      resourceId: user.id,
      metadata: { targetUserId: user.id, username: user.username, role: user.role },
    })

    return NextResponse.json({ user }, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message === 'Forbidden') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
    console.error('[POST /api/admin/users]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
