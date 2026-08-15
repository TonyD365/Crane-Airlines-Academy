import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createMockPrisma } from '../mocks'

// Create mocks before importing modules
const mockPrisma = createMockPrisma()

// Mock the prisma module
vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

// Mock payload-utils
vi.mock('@/lib/payload-utils', () => ({
  payloadTableExists: vi.fn(),
}))

// Mock getPayload
vi.mock('payload', () => ({
  getPayload: vi.fn(),
}))

// Mock payload config to avoid database connection
vi.mock('@/src/payload/payload.config', () => ({
  default: {},
}))

// Mock auth — verbose mode requires admin
vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

// Import after mocking
const { GET } = await import('@/app/api/health/route')
const { payloadTableExists } = await import('@/lib/payload-utils')
const { getPayload } = await import('payload')
const { auth } = await import('@/auth')
const mockedAuth = vi.mocked(auth)

// Helper to mock an admin session
const mockAdminAuth = () =>
  mockedAuth.mockResolvedValue({
    user: { id: 'admin-1', email: 'admin@test.com', name: 'Admin', role: 'PRESIDENT' },
  } as any)

describe('API: /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Set required environment variables
    process.env.DATABASE_URL = 'mock://database'
    process.env.PAYLOAD_SECRET = 'mock-payload-secret'
    process.env.AUTH_SECRET = 'mock-auth-secret'
    process.env.NEXTAUTH_URL = 'http://localhost:3000'

    // Default: unauthenticated
    mockedAuth.mockResolvedValue(null)

    // SELECT 1 ping returns truthy row
    vi.mocked(mockPrisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }] as any)

    vi.mocked(payloadTableExists).mockResolvedValue(true)
    vi.mocked(getPayload).mockResolvedValue({
      find: vi.fn(() => Promise.resolve({ docs: [], totalDocs: 0 })),
    } as any)
  })

  // ── Basic health gate ────────────────────────────────────────────────────────

  it('returns 200 with ok status when all checks pass', async () => {
    const request = new NextRequest('http://localhost:3000/api/health')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('ok')
    expect(data.checks.database).toBe('connected')
    expect(data.checks.payload).toBe('ok')
  })

  it('always returns timestamp on a plain GET', async () => {
    // environment and version are only exposed in verbose (admin) mode — see route comments
    const request = new NextRequest('http://localhost:3000/api/health')

    const response = await GET(request)
    const data = await response.json()

    expect(typeof data.timestamp).toBe('string')
    // Non-verbose GET intentionally omits environment and version for security
    expect(data.environment).toBeUndefined()
    expect(data.version).toBeUndefined()
  })

  it('returns environment and version in verbose admin mode', async () => {
    mockAdminAuth()
    // Stub the extra $queryRaw calls made in verbose mode
    vi.mocked(mockPrisma.$queryRaw)
      .mockResolvedValueOnce([{ '?column?': 1 }] as any)             // SELECT 1 ping
      .mockResolvedValueOnce([{                                        // DB identity
        current_database: 'test', current_user: 'admin',
        server_addr: null, server_port: null,
      }] as any)
      .mockResolvedValueOnce([{ courses: null, users: null, modules: null }] as any) // table check

    const request = new NextRequest('http://localhost:3000/api/health?verbose=1')

    const response = await GET(request)
    const data = await response.json()

    expect(data.environment).toBeDefined()
    expect(data.version).toBeDefined()
    expect(typeof data.timestamp).toBe('string')
  })

  it('does NOT expose dbIdentity on plain GET (security fix)', async () => {
    const request = new NextRequest('http://localhost:3000/api/health')

    const response = await GET(request)
    const data = await response.json()

    // dbIdentity is a verbose-only field restricted to authenticated admins
    expect(data.dbIdentity).toBeUndefined()
  })

  // ── DB errors ─────────────────────────────────────────────────────────────────

  it('returns error status when database is unreachable', async () => {
    vi.mocked(mockPrisma.$queryRaw).mockRejectedValueOnce(new Error('Connection failed'))

    const request = new NextRequest('http://localhost:3000/api/health')

    const response = await GET(request)
    const data = await response.json()

    expect(data.status).toBe('error')
    expect(data.checks.database).toBe('error')
    expect(data.errors).toContain('Database connection failed: Connection failed')
  })

  it('aggregates errors from multiple failing checks', async () => {
    vi.mocked(mockPrisma.$queryRaw).mockRejectedValue(new Error('DB Error'))
    vi.mocked(payloadTableExists).mockRejectedValue(new Error('Payload Error'))

    const request = new NextRequest('http://localhost:3000/api/health')

    const response = await GET(request)
    const data = await response.json()

    expect(data.status).toBe('error')
    expect(Array.isArray(data.errors)).toBe(true)
    expect(data.errors.length).toBeGreaterThan(0)
  })

  // ── Environment variable checks ───────────────────────────────────────────────

  it('returns 500 and flags missing required env vars', async () => {
    const originalURL = process.env.DATABASE_URL
    delete process.env.DATABASE_URL

    const request = new NextRequest('http://localhost:3000/api/health')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.checks.requiredEnv).toBe('missing')
    expect(data.missingEnv).toContain('DATABASE_URL')

    // Restore
    if (originalURL) process.env.DATABASE_URL = originalURL
  })

  it('marks requiredEnv complete when all vars are present', async () => {
    const request = new NextRequest('http://localhost:3000/api/health')

    const response = await GET(request)
    const data = await response.json()

    expect(data.checks.requiredEnv).toBe('complete')
  })

  // ── Payload / courses ─────────────────────────────────────────────────────────

  it('marks courses not-accessible when payload tables are missing', async () => {
    vi.mocked(payloadTableExists).mockResolvedValue(false)

    const request = new NextRequest('http://localhost:3000/api/health')

    const response = await GET(request)
    const data = await response.json()

    expect(data.checks.courses).toBe('not-accessible')
    expect(data.errors).toContain(
      'Payload tables not found - run migrations: npm run payload:migrate',
    )
  })

  it('marks courses accessible when payload returns docs', async () => {
    vi.mocked(getPayload).mockResolvedValue({
      find: vi.fn(() => Promise.resolve({ docs: [{ id: '1' }], totalDocs: 1 })),
    } as any)

    const request = new NextRequest('http://localhost:3000/api/health')

    const response = await GET(request)
    const data = await response.json()

    expect(data.checks.courses).toBeDefined()
  })

  // ── Verbose mode (admin-only) ─────────────────────────────────────────────────

  it('returns 403 for ?verbose=1 when unauthenticated', async () => {
    mockedAuth.mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/health?verbose=1')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toBe('Forbidden')
  })

  it('returns 403 for ?verbose=1 when authenticated as STUDENT', async () => {
    mockedAuth.mockResolvedValue({
      user: { id: 'user-1', email: 'student@test.com', role: 'STUDENT' },
    } as any)

    const request = new NextRequest('http://localhost:3000/api/health?verbose=1')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(403)
  })

  it('returns verbose payload for ?verbose=1 when authenticated as ADMIN', async () => {
    mockAdminAuth()

    // Second $queryRaw call returns identity info (for verbose only)
    vi.mocked(mockPrisma.$queryRaw)
      .mockResolvedValueOnce([{ '?column?': 1 }] as any)       // SELECT 1
      .mockResolvedValueOnce([{                                  // identity query
        current_database: 'testdb',
        current_user:     'testuser',
        server_addr:      '127.0.0.1',
        server_port:      5432,
      }] as any)
      .mockResolvedValueOnce([{                                  // table check
        courses: 'payload.courses',
        users:   'public.users',
        modules: 'payload.modules',
      }] as any)

    const request = new NextRequest('http://localhost:3000/api/health?verbose=1')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.verbose).toBeDefined()
    expect(data.dbIdentity).toBeDefined()
    expect(data.dbIdentity.database).toBe('testdb')
    expect(data.dbIdentity.user).toBe('testuser')
  })
})
