/**
 * API tests — POST /api/admin/create-course
 *
 * Covers:
 * - 401 for unauthenticated callers
 * - 403 for authenticated STUDENT callers
 * - 200 + course id on success
 * - 500 when createCourse returns no id
 * - Error messages do not leak internal details
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/auth', () => ({ auth: vi.fn() }))
vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@/app/(admin)/admin/actions', () => ({
  createCourse: vi.fn(),
}))

// ─── Deferred imports ─────────────────────────────────────────────────────────

const { POST }       = await import('@/app/api/admin/create-course/route')
const { auth }       = await import('@/auth')
const { getPayload }  = await import('payload')
const { createCourse } = await import('@/app/(admin)/admin/actions')

const mockedAuth         = vi.mocked(auth)
const mockedGetPayload   = vi.mocked(getPayload)
const mockedCreateCourse = vi.mocked(createCourse)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function adminSession() {
  mockedAuth.mockResolvedValue({
    user: { id: 'admin-1', email: 'admin@test.com', role: 'PRESIDENT', name: 'Admin' },
  } as any)
}

function studentSession() {
  mockedAuth.mockResolvedValue({
    user: { id: 'student-1', email: 'student@test.com', role: 'STUDENT', name: 'Student' },
  } as any)
}

function makePayload(existingSubjects: any[] = []) {
  return {
    find:   vi.fn().mockResolvedValue({ docs: existingSubjects }),
    create: vi.fn().mockResolvedValue({ id: 'default-subject-id', name: 'General' }),
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/admin/create-course', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.DATABASE_URL = 'mock://db'
  })

  it('returns 401 when caller has no session', async () => {
    mockedAuth.mockResolvedValue(null)

    const req = new NextRequest('http://localhost/api/admin/create-course', { method: 'POST' })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('returns 403 when caller is a STUDENT', async () => {
    studentSession()

    const req = new NextRequest('http://localhost/api/admin/create-course', { method: 'POST' })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.error).toBe('Forbidden')
  })

  it('returns 200 with course id on successful creation', async () => {
    adminSession()

    mockedGetPayload.mockResolvedValue(makePayload([{ id: 'sub-1', name: 'General' }]) as any)
    mockedCreateCourse.mockResolvedValue({ id: 'new-course-123' } as any)

    const req = new NextRequest('http://localhost/api/admin/create-course', { method: 'POST' })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.id).toBe('new-course-123')
  })

  it('creates a default "General" subject when none exist', async () => {
    adminSession()

    const payload = makePayload([]) // no existing subjects
    payload.create = vi.fn().mockResolvedValue({ id: 'general-subject-id', name: 'General' })
    mockedGetPayload.mockResolvedValue(payload as any)
    mockedCreateCourse.mockResolvedValue({ id: 'course-1' } as any)

    const req = new NextRequest('http://localhost/api/admin/create-course', { method: 'POST' })
    await POST(req)

    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'subjects',
        data: expect.objectContaining({ name: 'General' }),
      }),
    )
  })

  it('returns 500 with generic message when createCourse returns no id', async () => {
    adminSession()

    mockedGetPayload.mockResolvedValue(makePayload([{ id: 'sub-1' }]) as any)
    mockedCreateCourse.mockResolvedValue({} as any) // no id in response

    const req = new NextRequest('http://localhost/api/admin/create-course', { method: 'POST' })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.ok).toBe(false)
    // Error message must NOT leak internal details like stack traces
    expect(data.error).toBe('Failed to create course')
    expect(data.error).not.toContain('Error:')
  })

  it('returns 500 with generic message when createCourse throws', async () => {
    adminSession()

    mockedGetPayload.mockResolvedValue(makePayload([{ id: 'sub-1' }]) as any)
    mockedCreateCourse.mockRejectedValue(new Error('DB constraint violation'))

    const req = new NextRequest('http://localhost/api/admin/create-course', { method: 'POST' })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(500)
    // Internal error details must not be sent to the client
    expect(data.error).not.toContain('DB constraint violation')
  })
})
