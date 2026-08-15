/**
 * API tests — /api/subjects (GET, POST, PUT, DELETE)
 *
 * Routes use Payload Local API (getPayload). Mocks intercept getPayload so no DB is required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockPrisma, resetAllMocks } from '../mocks'

process.env.SKIP_DB_SETUP = '1'

const mockPrisma = createMockPrisma()

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/auth', () => ({ auth: vi.fn() }))
vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))

const { GET, POST, PUT, DELETE } = await import('@/app/api/subjects/route')
const { auth } = await import('@/auth')
const { getPayload } = await import('payload')

const mockedAuth = vi.mocked(auth)
const mockedGetPayload = vi.mocked(getPayload)

function adminSession() {
  mockedAuth.mockResolvedValue({
    user: { id: 'admin-1', email: 'admin@test.com', role: 'PRESIDENT', name: 'Admin' },
  } as any)
}

function makeRequest(method: string, url: string, body?: object): Request {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

function mockPayloadApi(overrides: Partial<{
  find: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}> = {}) {
  const api = {
    find: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    ...overrides,
  }
  mockedGetPayload.mockResolvedValue(api as any)
  return api
}

describe('GET /api/subjects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetAllMocks(mockPrisma)
    mockedAuth.mockResolvedValue(null)
  })

  it('returns 200 with subjects for unauthenticated callers', async () => {
    mockPayloadApi({
      find: vi.fn().mockResolvedValue({
        docs: [
          { id: '1', name: 'Mathematics', slug: 'mathematics' },
          { id: '2', name: 'Physics', slug: 'physics' },
        ],
      }),
    })

    const req = makeRequest('GET', 'http://localhost/api/subjects')
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.subjects).toHaveLength(2)
    expect(data.subjects[0].name).toBe('Mathematics')
  })

  it('returns empty subjects array and 500 when Payload throws', async () => {
    mockPayloadApi({
      find: vi.fn().mockRejectedValue(new Error('DB down')),
    })

    const req = makeRequest('GET', 'http://localhost/api/subjects')
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(Array.isArray(data.subjects)).toBe(true)
    expect(data.subjects).toHaveLength(0)
  })

  it('maps docs to { id, name, slug, tagSlugs } shape', async () => {
    mockPayloadApi({
      find: vi.fn().mockResolvedValue({
        docs: [{ id: 'abc', name: 'Chemistry', slug: 'chemistry' }],
      }),
    })

    const req = makeRequest('GET', 'http://localhost/api/subjects')
    const res = await GET(req)
    const data = await res.json()

    expect(data.subjects[0].id).toBe('abc')
    expect(data.subjects[0].name).toBe('Chemistry')
    expect(data.subjects[0].slug).toBe('chemistry')
    expect(Array.isArray(data.subjects[0].tagSlugs)).toBe(true)
  })
})

describe('POST /api/subjects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetAllMocks(mockPrisma)
  })

  it('returns 401-equivalent error for unauthenticated requests', async () => {
    mockedAuth.mockResolvedValue(null)
    mockPayloadApi()

    const req = makeRequest('POST', 'http://localhost/api/subjects', { name: 'Art' })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBeDefined()
  })

  it('returns 400 when name is missing', async () => {
    adminSession()
    mockPayloadApi()
    const req = makeRequest('POST', 'http://localhost/api/subjects', { name: '' })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Subject name is required')
  })

  it('returns 400 when name is not a string', async () => {
    adminSession()
    mockPayloadApi()
    const req = makeRequest('POST', 'http://localhost/api/subjects', { name: 123 })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Subject name is required')
  })

  it('returns 400 when name is only whitespace', async () => {
    adminSession()
    mockPayloadApi()
    const req = makeRequest('POST', 'http://localhost/api/subjects', { name: '   ' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('creates and returns the new subject (201) for admin', async () => {
    adminSession()
    const create = vi.fn().mockResolvedValue({
      id: 'sub-new',
      name: 'Biology',
      slug: 'biology',
    })
    mockPayloadApi({ create })

    const req = makeRequest('POST', 'http://localhost/api/subjects', {
      name: 'Biology',
      slug: 'biology',
    })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.subject.name).toBe('Biology')
    expect(data.subject.slug).toBe('biology')
    expect(create).toHaveBeenCalled()
  })

  it('auto-generates slug from name when slug is not provided', async () => {
    adminSession()
    mockPayloadApi({
      create: vi.fn().mockResolvedValue({
        id: 'sub-new',
        name: 'Linear Algebra',
        slug: 'linear-algebra',
      }),
    })

    const req = makeRequest('POST', 'http://localhost/api/subjects', {
      name: 'Linear Algebra',
    })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.subject.slug).toBe('linear-algebra')
  })
})

describe('PUT /api/subjects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetAllMocks(mockPrisma)
  })

  it('returns 500-error for unauthenticated requests', async () => {
    mockedAuth.mockResolvedValue(null)
    mockPayloadApi()
    const req = makeRequest('PUT', 'http://localhost/api/subjects?id=sub-1', { name: 'New' })
    const res = await PUT(req)
    expect(res.status).toBe(500)
  })

  it('returns 400 when id query param is missing', async () => {
    adminSession()
    mockPayloadApi()
    const req = makeRequest('PUT', 'http://localhost/api/subjects', { name: 'New Name' })
    const res = await PUT(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Missing id')
  })

  it('returns 400 when name is missing', async () => {
    adminSession()
    mockPayloadApi()
    const req = makeRequest('PUT', 'http://localhost/api/subjects?id=sub-1', { name: '' })
    const res = await PUT(req)
    expect(res.status).toBe(400)
  })

  it('returns 404 when subject not found (update throws)', async () => {
    adminSession()
    mockPayloadApi({
      update: vi.fn().mockRejectedValue(new Error('Not found')),
    })
    const req = makeRequest('PUT', 'http://localhost/api/subjects?id=nonexistent', {
      name: 'Renamed',
    })
    const res = await PUT(req)
    expect(res.status).toBe(404)
  })

  it('returns 200 with updated subject on success', async () => {
    adminSession()
    mockPayloadApi({
      update: vi.fn().mockResolvedValue({}),
    })
    const req = makeRequest('PUT', 'http://localhost/api/subjects?id=sub-1', {
      name: 'Renamed Subject',
    })
    const res = await PUT(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.subject.name).toBe('Renamed Subject')
    expect(data.subject.id).toBe('sub-1')
  })
})

describe('DELETE /api/subjects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetAllMocks(mockPrisma)
  })

  it('returns 500-error for unauthenticated requests', async () => {
    mockedAuth.mockResolvedValue(null)
    mockPayloadApi()
    const req = makeRequest('DELETE', 'http://localhost/api/subjects?id=sub-1')
    const res = await DELETE(req)
    expect(res.status).toBe(500)
  })

  it('returns 400 when id query param is missing', async () => {
    adminSession()
    mockPayloadApi()
    const req = makeRequest('DELETE', 'http://localhost/api/subjects')
    const res = await DELETE(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Missing id')
  })

  it('returns 404 when subject does not exist (delete throws)', async () => {
    adminSession()
    mockPayloadApi({
      delete: vi.fn().mockRejectedValue(new Error('Not found')),
    })
    const req = makeRequest('DELETE', 'http://localhost/api/subjects?id=ghost')
    const res = await DELETE(req)
    expect(res.status).toBe(404)
  })

  it('returns 200 success on successful deletion', async () => {
    adminSession()
    const del = vi.fn().mockResolvedValue({})
    mockPayloadApi({ delete: del })
    const req = makeRequest('DELETE', 'http://localhost/api/subjects?id=sub-1')
    const res = await DELETE(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(del).toHaveBeenCalled()
  })
})
