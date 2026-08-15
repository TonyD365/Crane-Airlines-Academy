import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockPrisma, resetAllMocks } from '../mocks'

const mockPrisma = createMockPrisma()

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/auth', () => ({ auth: vi.fn() }))

const { GET: decksGet, POST: decksPost } = await import('@/app/api/flashcard-decks/route')
const { getFlashcardDashboardSummary } = await import('@/lib/flashcards-dashboard-summary')
const { auth } = await import('@/auth')
const mockedAuth = vi.mocked(auth)

function adminSession() {
  mockedAuth.mockResolvedValue({
    user: { id: 'admin-1', email: 'admin@test.com', role: 'PRESIDENT', name: 'Admin', isPro: false },
  } as any)
}

function noSession() {
  mockedAuth.mockResolvedValue(null)
}

function req(method: string, url: string, body?: object): Request {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('flashcard-decks route', () => {
  beforeEach(() => {
    resetAllMocks(mockPrisma)
    vi.clearAllMocks()
  })

  it('GET /api/flashcard-decks enforces auth', async () => {
    noSession()
    const res = await decksGet()
    expect(res.status).toBe(401)
  })

  it('GET /api/flashcard-decks loads relation metadata for hierarchy', async () => {
    adminSession()
    mockPrisma.flashcardDeck.findMany.mockResolvedValue([] as any)

    const res = await decksGet()
    expect(res.status).toBe(200)
    expect(mockPrisma.flashcardDeck.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          parentDeck: expect.any(Object),
          childDecks: expect.any(Object),
        }),
      }),
    )
  })

  it('POST /api/flashcard-decks rejects standalone MAIN without name', async () => {
    adminSession()
    const res = await decksPost(
      req('POST', 'http://localhost/api/flashcard-decks', {
        type: 'MAIN',
      }),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.issues.name[0]).toMatch(/standalone|Name|required/i)
  })

  it('POST /api/flashcard-decks creates a standalone MAIN deck with name', async () => {
    adminSession()
    mockPrisma.flashcardDeck.create.mockResolvedValue({
      id: 'standalone-main-1',
      slug: 'cert-prep',
      name: 'Cert Prep',
      courseId: null,
      moduleId: null,
      parentDeckId: null,
      tags: [],
      childDecks: [],
      parentDeck: null,
      _count: { flashcards: 0 },
    } as any)

    const res = await decksPost(
      req('POST', 'http://localhost/api/flashcard-decks', {
        type: 'MAIN',
        name: 'Cert Prep',
      }),
    )
    expect(res.status).toBe(201)
    expect(mockPrisma.flashcardDeck.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Cert Prep',
          courseId: null,
          moduleId: null,
          parentDeckId: null,
        }),
      }),
    )
  })

  it('POST /api/flashcard-decks returns 409 when course already has a main deck', async () => {
    adminSession()
    mockPrisma.$queryRaw.mockResolvedValueOnce([{ id: 'course-1', title: 'Physics' }])
    mockPrisma.flashcardDeck.findFirst.mockResolvedValueOnce({ id: 'existing-main' } as any)

    const res = await decksPost(
      req('POST', 'http://localhost/api/flashcard-decks', {
        type: 'MAIN',
        courseId: 'course-1',
      }),
    )
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.issues.courseId[0]).toContain('already has a main deck')
    expect(mockPrisma.flashcardDeck.create).not.toHaveBeenCalled()
  })

  it('POST /api/flashcard-decks creates a valid subdeck linked to module', async () => {
    adminSession()
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([{ id: 'course-1', title: 'Physics' }])
      .mockResolvedValueOnce([{ id: 'module-1', title: 'Relativity' }])
    mockPrisma.flashcardDeck.findUnique.mockResolvedValue({
      id: 'main-deck-1',
      courseId: 'course-1',
      parentDeckId: null,
    } as any)
    mockPrisma.flashcardDeck.create.mockResolvedValue({
      id: 'subdeck-1',
      slug: 'module-1-deck',
      name: 'Module 1',
      courseId: 'course-1',
      moduleId: 'module-1',
      parentDeckId: 'main-deck-1',
      tags: [],
      childDecks: [],
      parentDeck: { id: 'main-deck-1', name: 'Physics', slug: 'physics-main' },
      _count: { flashcards: 0 },
    } as any)

    const res = await decksPost(
      req('POST', 'http://localhost/api/flashcard-decks', {
        type: 'SUBDECK',
        name: 'Custom typed title',
        courseId: 'course-1',
        moduleId: 'module-1',
        parentDeckId: 'main-deck-1',
      }),
    )
    expect(res.status).toBe(201)
    expect(mockPrisma.flashcardDeck.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Relativity',
          courseId: 'course-1',
          moduleId: 'module-1',
          parentDeckId: 'main-deck-1',
        }),
      }),
    )
  })

  it('POST /api/flashcard-decks creates a standalone SUBDECK under a standalone main', async () => {
    adminSession()
    mockPrisma.flashcardDeck.findUnique.mockResolvedValue({
      id: 'standalone-main-1',
      courseId: null,
      parentDeckId: null,
    } as any)
    mockPrisma.flashcardDeck.create.mockResolvedValue({
      id: 'standalone-sub-1',
      slug: 'week-1',
      name: 'Week 1',
      courseId: null,
      moduleId: null,
      parentDeckId: 'standalone-main-1',
      tags: [],
      childDecks: [],
      parentDeck: { id: 'standalone-main-1', name: 'Cert Prep', slug: 'cert-prep' },
      _count: { flashcards: 0 },
    } as any)

    const res = await decksPost(
      req('POST', 'http://localhost/api/flashcard-decks', {
        type: 'SUBDECK',
        parentDeckId: 'standalone-main-1',
        name: 'Week 1',
      }),
    )
    expect(res.status).toBe(201)
    expect(mockPrisma.flashcardDeck.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Week 1',
          courseId: null,
          moduleId: null,
          parentDeckId: 'standalone-main-1',
        }),
      }),
    )
  })

  it('POST /api/flashcard-decks rejects standalone SUBDECK parent that is a course main deck', async () => {
    adminSession()
    mockPrisma.flashcardDeck.findUnique.mockResolvedValue({
      id: 'course-main-1',
      courseId: 'course-1',
      parentDeckId: null,
    } as any)

    const res = await decksPost(
      req('POST', 'http://localhost/api/flashcard-decks', {
        type: 'SUBDECK',
        parentDeckId: 'course-main-1',
        name: 'Orphan attempt',
      }),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.issues.parentDeckId[0]).toMatch(/course|module/i)
    expect(mockPrisma.flashcardDeck.create).not.toHaveBeenCalled()
  })

  it('POST /api/flashcard-decks returns 409 when module already has a subdeck', async () => {
    adminSession()
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([{ id: 'course-1', title: 'Physics' }])
      .mockResolvedValueOnce([{ id: 'module-1', title: 'Mod' }])
    mockPrisma.flashcardDeck.findUnique.mockResolvedValue({
      id: 'main-deck-1',
      courseId: 'course-1',
      parentDeckId: null,
    } as any)
    mockPrisma.flashcardDeck.findFirst.mockResolvedValueOnce({ id: 'existing-subdeck' } as any)

    const res = await decksPost(
      req('POST', 'http://localhost/api/flashcard-decks', {
        type: 'SUBDECK',
        name: 'Duplicate',
        courseId: 'course-1',
        moduleId: 'module-1',
        parentDeckId: 'main-deck-1',
      }),
    )
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.issues.moduleId[0]).toContain('already has a linked subdeck')
    expect(mockPrisma.flashcardDeck.create).not.toHaveBeenCalled()
  })

  it('DELETE /api/flashcard-decks/[id] removes a subdeck and its flashcards', async () => {
    adminSession()
    mockPrisma.flashcardDeck.findUnique.mockResolvedValue({
      id: 'sub-1',
      parentDeckId: 'main-1',
    } as any)
    const { DELETE: deckDelete } = await import('@/app/api/flashcard-decks/[id]/route')
    const res = await deckDelete(
      new Request('http://localhost/api/flashcard-decks/sub-1', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'sub-1' }) },
    )
    expect(res.status).toBe(200)
    expect(mockPrisma.$transaction).toHaveBeenCalled()
    expect(mockPrisma.flashcard.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deckId: 'sub-1' } }),
    )
    expect(mockPrisma.flashcardDeck.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sub-1' } }),
    )
  })

  it('DELETE /api/flashcard-decks/[id] cascades main deck, subdecks, and flashcards', async () => {
    adminSession()
    mockPrisma.flashcardDeck.findUnique.mockResolvedValue({
      id: 'main-1',
      parentDeckId: null,
    } as any)
    mockPrisma.flashcardDeck.findMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }] as any)
    const { DELETE: deckDelete } = await import('@/app/api/flashcard-decks/[id]/route')
    const res = await deckDelete(
      new Request('http://localhost/api/flashcard-decks/main-1', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'main-1' }) },
    )
    expect(res.status).toBe(200)
    expect(mockPrisma.flashcard.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deckId: { in: ['main-1', 'c1', 'c2'] } } }),
    )
    expect(mockPrisma.flashcardDeck.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['c1', 'c2'] } } }),
    )
    expect(mockPrisma.flashcardDeck.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'main-1' } }),
    )
  })
})

describe('getFlashcardDashboardSummary', () => {
  beforeEach(() => {
    resetAllMocks(mockPrisma)
    vi.clearAllMocks()
  })

  it('returns empty when user has no started courses and no standalone enrollments', async () => {
    mockPrisma.courseProgress.findMany.mockResolvedValue([])
    mockPrisma.userStandaloneFlashcardDeck.findMany.mockResolvedValue([])
    const summary = await getFlashcardDashboardSummary('user-1')
    expect(summary.decks).toHaveLength(0)
    expect(summary.all.total).toBe(0)
  })

  it('builds course -> deck -> subdeck hierarchy with aggregated stats', async () => {
    const now = new Date()
    const due = new Date(now.getTime() - 60_000)

    mockPrisma.courseProgress.findMany.mockResolvedValue([{ courseId: 'course-1' }] as any)
    mockPrisma.userStandaloneFlashcardDeck.findMany.mockResolvedValue([])
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([{ id: 'course-1', slug: 'physics', title: 'Physics' }])
      .mockResolvedValueOnce([{ id: 'module-1', title: 'Relativity' }])
    mockPrisma.flashcardDeck.findMany.mockResolvedValue([
      { id: 'main-1', name: 'Physics Main', slug: 'physics-main', courseId: 'course-1', moduleId: null, parentDeckId: null },
      { id: 'sub-1', name: 'Relativity Subdeck', slug: 'physics-relativity', courseId: 'course-1', moduleId: 'module-1', parentDeckId: 'main-1' },
    ] as any)
    mockPrisma.flashcard.findMany.mockResolvedValue([
      {
        deck: { id: 'sub-1', name: 'Relativity Subdeck', slug: 'physics-relativity', courseId: 'course-1', moduleId: 'module-1', parentDeckId: 'main-1' },
        userProgress: [{ state: 'REVIEW', nextReviewAt: due }],
      },
      {
        deck: { id: 'sub-1', name: 'Relativity Subdeck', slug: 'physics-relativity', courseId: 'course-1', moduleId: 'module-1', parentDeckId: 'main-1' },
        userProgress: [],
      },
    ] as any)

    const summary = await getFlashcardDashboardSummary('user-1')
    expect(summary.decks).toHaveLength(1)
    expect(summary.decks[0].source).toBe('course')
    expect(summary.decks[0].course!.slug).toBe('physics')
    expect(summary.decks[0].subdecks).toHaveLength(1)
    expect(summary.decks[0].subdecks[0].deck.moduleTitle).toBe('Relativity')
    expect(summary.decks[0].stats.total).toBe(2)
    expect(summary.decks[0].stats.newCards).toBe(1)
    expect(summary.decks[0].stats.due).toBe(1)
  })
})
