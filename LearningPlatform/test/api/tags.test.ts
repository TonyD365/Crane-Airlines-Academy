/**
 * API tests — Tag routes
 *
 * Covers:
 * - GET    /api/tags              (list all tags, admin only)
 * - POST   /api/tags              (create tag, admin only)
 * - PUT    /api/tags/[id]         (rename tag + sync embedded tags on Payload tasks)
 * - DELETE /api/tags/[id]         (remove tag from tasks via Payload, then Prisma delete)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockPrisma } from '../mocks'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = createMockPrisma()

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/auth', () => ({ auth: vi.fn() }))
vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/payload-task-tag-counts', () => ({
  getTaskCountsByPrismaTagId: vi.fn(),
}))
vi.mock('next/cache', () => ({
  unstable_cache: (_fn: any) => _fn,
  revalidateTag: vi.fn(),
}))

// ─── Deferred imports ─────────────────────────────────────────────────────────

const { GET: listGet, POST: listPost } = await import('@/app/api/tags/route')
const { PUT: tagPut, DELETE: tagDelete } = await import('@/app/api/tags/[id]/route')
const { auth } = await import('@/auth')
const { getPayload } = await import('payload')
const { getTaskCountsByPrismaTagId } = await import('@/lib/payload-task-tag-counts')

const mockedAuth = vi.mocked(auth)
const mockedGetPayload = vi.mocked(getPayload)
const mockedTaskCounts = vi.mocked(getTaskCountsByPrismaTagId)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function adminSession() {
  mockedAuth.mockResolvedValue({
    user: { id: 'admin-1', email: 'admin@test.com', role: 'PRESIDENT', name: 'Admin' },
  } as any)
}

function noSession() {
  mockedAuth.mockResolvedValue(null)
}

function makeRequest(method: string, url: string, body?: object): Request {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

function routeCtx(id: string) {
  return { params: Promise.resolve({ id }) }
}

const MOCK_TAG = {
  id: 'tag-1',
  name: 'Calculus',
  slug: 'calculus',
  main: false,
  createdAt: new Date(),
  updatedAt: new Date(),
}

// ─── GET /api/tags ─────────────────────────────────────────────────────────────

describe('GET /api/tags', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    adminSession()
    mockedTaskCounts.mockResolvedValue(
      new Map([
        ['tag-1', 2],
        ['tag-2', 1],
      ]),
    )
  })

  it('returns 200 with tags array for admin', async () => {
    vi.mocked(mockPrisma.tag.findMany).mockResolvedValue([
      { id: 'tag-1', name: 'Calculus', slug: 'calculus', main: false, _count: { flashcards: 5 } },
      { id: 'tag-2', name: 'Algebra', slug: 'algebra', main: false, _count: { flashcards: 3 } },
    ] as any)

    const res = await listGet()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.tags).toHaveLength(2)
    expect(data.tags[0].name).toBe('Calculus')
    expect(data.tags[0]._count.tasks).toBe(2)
    expect(data.tags[1]._count.tasks).toBe(1)
  })

  it('returns 401 for unauthenticated callers', async () => {
    noSession()
    const res = await listGet()
    expect(res.status).toBe(401)
  })
})

// ─── POST /api/tags ────────────────────────────────────────────────────────────

describe('POST /api/tags', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    adminSession()
  })

  it('creates a tag and returns 201', async () => {
    vi.mocked(mockPrisma.tag.findFirst).mockResolvedValue(null)
    vi.mocked(mockPrisma.tag.create).mockResolvedValue({
      id: 'tag-new', name: 'Topology', slug: 'topology',
    } as any)

    const res = await listPost(makeRequest('POST', 'http://localhost/api/tags', { name: 'Topology' }))
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.tag.name).toBe('Topology')
    expect(data.tag.slug).toBe('topology')
  })

  it('auto-generates slug from name', async () => {
    vi.mocked(mockPrisma.tag.findFirst).mockResolvedValue(null)
    vi.mocked(mockPrisma.tag.create).mockResolvedValue({
      id: 'tag-new', name: 'Linear Algebra', slug: 'linear-algebra',
    } as any)

    const res = await listPost(
      makeRequest('POST', 'http://localhost/api/tags', { name: 'Linear Algebra' }),
    )
    expect(res.status).toBe(201)
    expect(mockPrisma.tag.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slug: 'linear-algebra' }),
      }),
    )
  })

  it('returns 400 for empty name', async () => {
    const res = await listPost(makeRequest('POST', 'http://localhost/api/tags', { name: '' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Validation failed')
  })

  it('returns 409 when tag name already exists', async () => {
    vi.mocked(mockPrisma.tag.findFirst).mockResolvedValue(MOCK_TAG as any)

    const res = await listPost(makeRequest('POST', 'http://localhost/api/tags', { name: 'Calculus' }))
    expect(res.status).toBe(409)
  })

  it('returns 401 for unauthenticated callers', async () => {
    noSession()
    const res = await listPost(makeRequest('POST', 'http://localhost/api/tags', { name: 'Physics' }))
    expect(res.status).toBe(401)
  })
})

// ─── PUT /api/tags/[id] ────────────────────────────────────────────────────────

describe('PUT /api/tags/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    adminSession()
    mockedGetPayload.mockResolvedValue({
      find: vi.fn().mockResolvedValue({ docs: [], hasNextPage: false }),
      findByID: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    } as any)
  })

  it('renames the tag (name + auto-slug) and returns 200', async () => {
    vi.mocked(mockPrisma.tag.findUnique).mockResolvedValue(MOCK_TAG as any)
    vi.mocked(mockPrisma.tag.findFirst).mockResolvedValue(null)    // no conflict
    vi.mocked(mockPrisma.tag.update).mockResolvedValue({
      ...MOCK_TAG, name: 'Advanced Calculus', slug: 'advanced-calculus',
    } as any)

    const res = await tagPut(
      makeRequest('PUT', 'http://localhost/api/tags/tag-1', { name: 'Advanced Calculus' }),
      routeCtx('tag-1'),
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.tag.name).toBe('Advanced Calculus')
  })

  it('syncs embedded tags on Payload tasks after rename', async () => {
    vi.mocked(mockPrisma.tag.findUnique).mockResolvedValue(MOCK_TAG as any)
    vi.mocked(mockPrisma.tag.findFirst).mockResolvedValue(null)
    vi.mocked(mockPrisma.tag.update).mockResolvedValue({
      ...MOCK_TAG, name: 'Advanced Calculus', slug: 'advanced-calculus',
    } as any)

    const find = vi.fn().mockResolvedValue({
      docs: [
        {
          id: 'task-1',
          tags: [{ tagId: 'tag-1', name: 'Calculus', slug: 'calculus' }],
        },
      ],
      hasNextPage: false,
    })
    const findByID = vi.fn().mockResolvedValue({
      id: 'task-1',
      tags: [{ tagId: 'tag-1', name: 'Calculus', slug: 'calculus' }],
    })
    const update = vi.fn().mockResolvedValue({})
    mockedGetPayload.mockResolvedValue({ find, findByID, update } as any)

    await tagPut(
      makeRequest('PUT', 'http://localhost/api/tags/tag-1', { name: 'Advanced Calculus' }),
      routeCtx('tag-1'),
    )

    expect(find).toHaveBeenCalled()
    expect(update).toHaveBeenCalled()
  })

  it('does not call Payload to sync tasks when name and slug are unchanged', async () => {
    vi.mocked(mockPrisma.tag.findUnique).mockResolvedValue(MOCK_TAG as any)
    vi.mocked(mockPrisma.tag.update).mockResolvedValue({
      ...MOCK_TAG, main: true,
    } as any)

    await tagPut(
      makeRequest('PUT', 'http://localhost/api/tags/tag-1', { main: true }),
      routeCtx('tag-1'),
    )

    expect(mockedGetPayload).not.toHaveBeenCalled()
  })

  it('returns 404 when tag does not exist', async () => {
    vi.mocked(mockPrisma.tag.findUnique).mockResolvedValue(null)

    const res = await tagPut(
      makeRequest('PUT', 'http://localhost/api/tags/missing', { name: 'X' }),
      routeCtx('missing'),
    )
    expect(res.status).toBe(404)
  })

  it('returns 409 on name conflict with another tag', async () => {
    vi.mocked(mockPrisma.tag.findUnique).mockResolvedValue(MOCK_TAG as any)
    // A different tag already has the target name
    vi.mocked(mockPrisma.tag.findFirst).mockResolvedValue({ id: 'tag-other', name: 'Algebra' } as any)

    const res = await tagPut(
      makeRequest('PUT', 'http://localhost/api/tags/tag-1', { name: 'Algebra' }),
      routeCtx('tag-1'),
    )
    expect(res.status).toBe(409)
  })

  it('returns 401 for unauthenticated callers', async () => {
    noSession()
    const res = await tagPut(
      makeRequest('PUT', 'http://localhost/api/tags/tag-1', { name: 'X' }),
      routeCtx('tag-1'),
    )
    expect(res.status).toBe(401)
  })

  it('accepts explicit slug override', async () => {
    vi.mocked(mockPrisma.tag.findUnique).mockResolvedValue(MOCK_TAG as any)
    vi.mocked(mockPrisma.tag.findFirst).mockResolvedValue(null)
    vi.mocked(mockPrisma.tag.update).mockResolvedValue({
      ...MOCK_TAG, name: 'Calculus II', slug: 'calc-2',
    } as any)

    mockedGetPayload.mockResolvedValue({
      find: vi.fn().mockResolvedValue({ docs: [], hasNextPage: false }),
      findByID: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    } as any)

    await tagPut(
      makeRequest('PUT', 'http://localhost/api/tags/tag-1', { name: 'Calculus II', slug: 'calc-2' }),
      routeCtx('tag-1'),
    )

    expect(mockPrisma.tag.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slug: 'calc-2' }),
      }),
    )
  })
})

// ─── DELETE /api/tags/[id] ────────────────────────────────────────────────────

describe('DELETE /api/tags/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    adminSession()
    mockedGetPayload.mockResolvedValue({
      find: vi.fn().mockResolvedValue({ docs: [], hasNextPage: false }),
      update: vi.fn(),
    } as any)
  })

  it('deletes tag and returns { success: true }', async () => {
    vi.mocked(mockPrisma.tag.findUnique).mockResolvedValue(MOCK_TAG as any)
    vi.mocked(mockPrisma.tag.delete).mockResolvedValue(MOCK_TAG as any)

    const res = await tagDelete(
      makeRequest('DELETE', 'http://localhost/api/tags/tag-1'),
      routeCtx('tag-1'),
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it('removes tag from Payload tasks before Prisma delete', async () => {
    vi.mocked(mockPrisma.tag.findUnique).mockResolvedValue(MOCK_TAG as any)
    vi.mocked(mockPrisma.tag.delete).mockResolvedValue(MOCK_TAG as any)

    const find = vi
      .fn()
      .mockResolvedValueOnce({
        docs: [{ id: 'task-1', tags: [{ tagId: 'tag-1' }] }],
        hasNextPage: false,
      })
      .mockResolvedValueOnce({ docs: [], hasNextPage: false })
    const update = vi.fn().mockResolvedValue({})
    mockedGetPayload.mockResolvedValue({ find, update } as any)

    await tagDelete(
      makeRequest('DELETE', 'http://localhost/api/tags/tag-1'),
      routeCtx('tag-1'),
    )

    expect(update).toHaveBeenCalled()
    expect(mockPrisma.tag.delete).toHaveBeenCalledWith({ where: { id: 'tag-1' } })
  })

  it('still deletes the tag even if Payload task cleanup fails', async () => {
    vi.mocked(mockPrisma.tag.findUnique).mockResolvedValue(MOCK_TAG as any)
    vi.mocked(mockPrisma.tag.delete).mockResolvedValue(MOCK_TAG as any)
    mockedGetPayload.mockRejectedValue(new Error('Payload init failed'))

    const res = await tagDelete(
      makeRequest('DELETE', 'http://localhost/api/tags/tag-1'),
      routeCtx('tag-1'),
    )

    // Cleanup error is non-fatal; delete should still succeed
    expect(res.status).toBe(200)
    expect(mockPrisma.tag.delete).toHaveBeenCalled()
  })

  it('returns 404 when tag does not exist', async () => {
    vi.mocked(mockPrisma.tag.findUnique).mockResolvedValue(null)

    const res = await tagDelete(
      makeRequest('DELETE', 'http://localhost/api/tags/missing'),
      routeCtx('missing'),
    )
    expect(res.status).toBe(404)
  })

  it('returns 401 for unauthenticated callers', async () => {
    noSession()
    const res = await tagDelete(
      makeRequest('DELETE', 'http://localhost/api/tags/tag-1'),
      routeCtx('tag-1'),
    )
    expect(res.status).toBe(401)
  })
})
