import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { Role } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-helpers'
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
          email: true,
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
 * Create a new account. Admin-only — this replaces public self-service
 * registration. Users sign in with their RBX username; a synthetic email is
 * stored to satisfy the unique/non-null email column and keep the rest of the
 * app (which reads `user.email`) working.
 */
const createUserSchema = z.object({
  // RBX usernames: letters, digits, and underscores are the common set.
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(32)
    .regex(/^[A-Za-z0-9_]+$/, 'Username may only contain letters, numbers, and underscores'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  name: z.string().trim().max(100).optional(),
  role: z.nativeEnum(Role).optional(),
  groupId: z.string().min(1).nullable().optional(),
})

function isStrongPassword(password: string): boolean {
  return (
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  )
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin()

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

    const { password, name, role, groupId } = parsed.data
    if (!isStrongPassword(password)) {
      return NextResponse.json(
        { error: 'Password must include uppercase, lowercase, a number, and a special character' },
        { status: 400 },
      )
    }

    const username = parsed.data.username.toLowerCase()
    const email = `${username}@rbx.local`

    const existing = await prisma.user.findFirst({
      where: { OR: [{ username }, { email }] },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json({ error: 'That username is already taken' }, { status: 409 })
    }

    if (groupId) {
      const group = await prisma.group.findUnique({ where: { id: groupId }, select: { id: true } })
      if (!group) {
        return NextResponse.json({ error: 'Selected group does not exist' }, { status: 400 })
      }
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        name: name?.trim() || null,
        role: role ?? Role.STUDENT,
        groupId: groupId ?? null,
      },
      select: {
        id: true,
        email: true,
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
