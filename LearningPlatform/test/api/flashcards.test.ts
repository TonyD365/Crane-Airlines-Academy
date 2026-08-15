/**
 * API tests — Flashcard routes
 *
 * Covers:
 * - GET   /api/flashcards               (list, optional tag filter, auth gate)
 * - POST  /api/flashcards               (create, Zod validation, auth gate)
 * - GET   /api/flashcards/[id]          (get by id, 404, auth gate)
 * - PUT   /api/flashcards/[id]          (update, Zod validation, auth gate)
 * - DELETE /api/flashcards/[id]         (delete, auth gate)
 * - POST  /api/flashcards/[id]/review   (SRS review, validates answer enum, auth gate)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockPrisma } from '../mocks'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = createMockPrisma()

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/auth',       () => ({ auth: vi.fn() }))

// ─── Deferred imports ─────────────────────────────────────────────────────────

const { GET: listGet, POST: listPost }            = await import('@/app/api/flashcards/route')
const { GET: idGet, PUT: idPut, DELETE: idDelete } = await import('@/app/api/flashcards/[id]/route')
const { POST: reviewPost }                         = await import('@/app/api/flashcards/[id]/review/route')
const { auth } = await import('@/auth')
const mockedAuth = vi.mocked(auth)

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

const MOCK_FLASHCARD = {
  id:             'fc-1',
  question:       'What is 2+2?',
  answer:         '4',
  questionImageId: null,
  answerImageId:   null,
  deckId:         'deck-1',
  deck:           { id: 'deck-1', name: 'Test Deck', slug: 'test-deck' },
  state:           'NEW',
  interval:        0,
  easeFactor:      2.5,
  repetition:      0,
  stepIndex:       0,
  nextReviewAt:    null,
  lastReviewedAt:  null,
  lastResult:      null,
  createdAt:       new Date(),
  updatedAt:       new Date(),
  tags:            [],
}

const MOCK_SETTINGS = {
  id:                 'settings-1',
  userId:             'admin-1',
  newCardsPerDay:     20,
  maxReviews:         200,
  learningSteps:      '1 10',
  relearningSteps:    '10',
  graduatingInterval: 1,
  easyInterval:       4,
  startingEase:       2.5,
  masteredThreshold:  21,
}

// ─── GET /api/flashcards ──────────────────────────────────────────────────────

describe('GET /api/flashcards', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 401 for unauthenticated callers', async () => {
    noSession()
    const req = makeRequest('GET', 'http://localhost/api/flashcards')
    const res = await listGet(req)
    expect(res.status).toBe(401)
  })

  it('returns 403 for authenticated students', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1', email: 'x@x.com', role: 'STUDENT' } } as any)
    const req = makeRequest('GET', 'http://localhost/api/flashcards')
    const res = await listGet(req)
    expect(res.status).toBe(403)
  })

  it('returns 200 with flashcards for admin', async () => {
    adminSession()
    vi.mocked(mockPrisma.flashcard.findMany).mockResolvedValue([MOCK_FLASHCARD] as any)

    const req = makeRequest('GET', 'http://localhost/api/flashcards')
    const res = await listGet(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.flashcards).toHaveLength(1)
    expect(data.flashcards[0].id).toBe('fc-1')
  })

  it('filters by tagSlug query param when provided', async () => {
    adminSession()
    vi.mocked(mockPrisma.flashcard.findMany).mockResolvedValue([] as any)

    const req = makeRequest('GET', 'http://localhost/api/flashcards?tagSlug=math')
    await listGet(req)

    expect(mockPrisma.flashcard.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tags: { some: { slug: 'math' } } }),
      }),
    )
  })

  it('fetches without filter when no tagSlug is provided', async () => {
    adminSession()
    vi.mocked(mockPrisma.flashcard.findMany).mockResolvedValue([] as any)

    const req = makeRequest('GET', 'http://localhost/api/flashcards')
    await listGet(req)

    expect(mockPrisma.flashcard.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined }),
    )
  })

  it('filters by deckId when provided', async () => {
    adminSession()
    vi.mocked(mockPrisma.flashcard.findMany).mockResolvedValue([] as any)

    const req = makeRequest('GET', 'http://localhost/api/flashcards?deckId=sub-1')
    await listGet(req)

    expect(mockPrisma.flashcard.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deckId: 'sub-1' }),
      }),
    )
  })

  it('filters by mainDeckId (main deck + its subdecks) when provided', async () => {
    adminSession()
    vi.mocked(mockPrisma.flashcard.findMany).mockResolvedValue([] as any)

    const req = makeRequest('GET', 'http://localhost/api/flashcards?mainDeckId=main-1')
    await listGet(req)

    expect(mockPrisma.flashcard.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ deckId: 'main-1' }, { deck: { parentDeckId: 'main-1' } }],
        }),
      }),
    )
  })
})

// ─── POST /api/flashcards ─────────────────────────────────────────────────────

describe('POST /api/flashcards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(mockPrisma.flashcardDeck.findUnique).mockResolvedValue({ id: 'deck-1', parentDeckId: 'main-1' } as any)
    vi.mocked(mockPrisma.tag.findMany).mockResolvedValue([] as any)
  })

  it('returns 401 for unauthenticated callers', async () => {
    noSession()
    const req = makeRequest('POST', 'http://localhost/api/flashcards', { question: 'Q', answer: 'A', deckId: 'd1' })
    const res = await listPost(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 with validation errors for missing question', async () => {
    adminSession()
    const req = makeRequest('POST', 'http://localhost/api/flashcards', { answer: 'A' })
    const res = await listPost(req)
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.error).toBe('Validation failed')
    expect(data.issues).toBeDefined()
  })

  it('returns 400 with validation errors for missing answer', async () => {
    adminSession()
    const req = makeRequest('POST', 'http://localhost/api/flashcards', { question: 'Q?' })
    const res = await listPost(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when question is empty string', async () => {
    adminSession()
    const req = makeRequest('POST', 'http://localhost/api/flashcards', { question: '', answer: 'A' })
    const res = await listPost(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when deckId is missing', async () => {
    adminSession()
    const req = makeRequest('POST', 'http://localhost/api/flashcards', { question: 'Q', answer: 'A' })
    const res = await listPost(req)
    expect(res.status).toBe(400)
  })

  it('creates flashcard and returns 201 for valid body', async () => {
    adminSession()
    vi.mocked(mockPrisma.flashcard.create).mockResolvedValue({ ...MOCK_FLASHCARD, id: 'new-fc' } as any)

    const req = makeRequest('POST', 'http://localhost/api/flashcards', {
      question: 'What is the capital of France?',
      answer:   'Paris',
      deckId:   'deck-1',
      tagIds:   [],
    })
    const res = await listPost(req)
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.flashcard.id).toBe('new-fc')
    expect(mockPrisma.flashcard.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          question: 'What is the capital of France?',
          answer: 'Paris',
          deckId: 'deck-1',
        }),
      }),
    )
  })

  it('returns 400 when target deck is a course main deck', async () => {
    adminSession()
    vi.mocked(mockPrisma.flashcardDeck.findUnique).mockResolvedValue({
      id: 'deck-main',
      parentDeckId: null,
      courseId: 'course-1',
    } as any)

    const req = makeRequest('POST', 'http://localhost/api/flashcards', {
      question: 'Q',
      answer: 'A',
      deckId: 'deck-main',
      tagIds: [],
    })
    const res = await listPost(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.issues.deckId[0]).toMatch(/subdeck|course main/i)
  })

  it('creates flashcard on standalone main deck (direct cards)', async () => {
    adminSession()
    vi.mocked(mockPrisma.flashcardDeck.findUnique).mockResolvedValue({
      id: 'standalone-main',
      parentDeckId: null,
      courseId: null,
    } as any)
    vi.mocked(mockPrisma.flashcard.create).mockResolvedValue({ ...MOCK_FLASHCARD, id: 'new-direct' } as any)

    const req = makeRequest('POST', 'http://localhost/api/flashcards', {
      question: 'Q',
      answer: 'A',
      deckId: 'standalone-main',
      tagIds: [],
    })
    const res = await listPost(req)

    expect(res.status).toBe(201)
    expect(mockPrisma.flashcard.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deckId: 'standalone-main' }),
      }),
    )
  })

  it('connects tags when tagIds are provided', async () => {
    adminSession()
    vi.mocked(mockPrisma.tag.findMany).mockResolvedValue([{ id: 'tag-1' }, { id: 'tag-2' }] as any)
    vi.mocked(mockPrisma.flashcard.create).mockResolvedValue(MOCK_FLASHCARD as any)

    const req = makeRequest('POST', 'http://localhost/api/flashcards', {
      question: 'Q',
      answer:   'A',
      deckId:   'deck-1',
      tagIds:   ['tag-1', 'tag-2'],
    })
    await listPost(req)

    expect(mockPrisma.flashcard.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tags: { connect: [{ id: 'tag-1' }, { id: 'tag-2' }] },
        }),
      }),
    )
  })
})

// ─── GET /api/flashcards/[id] ─────────────────────────────────────────────────

describe('GET /api/flashcards/[id]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 401 when unauthenticated', async () => {
    noSession()
    const res = await idGet(makeRequest('GET', 'http://localhost/api/flashcards/fc-1'), routeCtx('fc-1'))
    expect(res.status).toBe(401)
  })

  it('returns 404 when flashcard does not exist', async () => {
    adminSession()
    vi.mocked(mockPrisma.flashcard.findUnique).mockResolvedValue(null)

    const res = await idGet(makeRequest('GET', 'http://localhost/api/flashcards/missing'), routeCtx('missing'))
    expect(res.status).toBe(404)
  })

  it('returns 200 with flashcard when found', async () => {
    adminSession()
    vi.mocked(mockPrisma.flashcard.findUnique).mockResolvedValue(MOCK_FLASHCARD as any)

    const res = await idGet(makeRequest('GET', 'http://localhost/api/flashcards/fc-1'), routeCtx('fc-1'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.flashcard.id).toBe('fc-1')
  })
})

// ─── PUT /api/flashcards/[id] ─────────────────────────────────────────────────

describe('PUT /api/flashcards/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(mockPrisma.flashcardDeck.findUnique).mockResolvedValue({ id: 'deck-1', parentDeckId: 'main-1' } as any)
  })

  it('returns 401 when unauthenticated', async () => {
    noSession()
    const res = await idPut(
      makeRequest('PUT', 'http://localhost/api/flashcards/fc-1', { question: 'Updated Q' }),
      routeCtx('fc-1'),
    )
    expect(res.status).toBe(401)
  })

  it('returns 400 when question is an empty string', async () => {
    adminSession()
    const res = await idPut(
      makeRequest('PUT', 'http://localhost/api/flashcards/fc-1', { question: '' }),
      routeCtx('fc-1'),
    )
    expect(res.status).toBe(400)
  })

  it('updates flashcard and returns 200', async () => {
    adminSession()
    const updated = { ...MOCK_FLASHCARD, question: 'Updated question' }
    vi.mocked(mockPrisma.flashcard.update).mockResolvedValue(updated as any)

    const res = await idPut(
      makeRequest('PUT', 'http://localhost/api/flashcards/fc-1', { question: 'Updated question' }),
      routeCtx('fc-1'),
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.flashcard.question).toBe('Updated question')
  })

  it('replaces tag connections when tagIds are provided', async () => {
    adminSession()
    vi.mocked(mockPrisma.flashcard.findUnique).mockResolvedValue({
      deckId: 'deck-1',
      tags: [{ id: 'prev' }],
    } as any)
    vi.mocked(mockPrisma.tag.findMany).mockResolvedValue([{ id: 't1' }] as any)
    vi.mocked(mockPrisma.flashcard.update).mockResolvedValue(MOCK_FLASHCARD as any)

    await idPut(
      makeRequest('PUT', 'http://localhost/api/flashcards/fc-1', { tagIds: ['t1'] }),
      routeCtx('fc-1'),
    )

    expect(mockPrisma.flashcard.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tags: { set: [{ id: 't1' }] } }),
      }),
    )
  })

  it('returns 400 when updating flashcard to a course main deck', async () => {
    adminSession()
    vi.mocked(mockPrisma.flashcard.findUnique).mockResolvedValue({
      deckId: 'deck-1',
      tags: [],
    } as any)
    vi.mocked(mockPrisma.flashcardDeck.findUnique).mockResolvedValue({
      id: 'deck-main',
      parentDeckId: null,
      courseId: 'course-1',
    } as any)

    const res = await idPut(
      makeRequest('PUT', 'http://localhost/api/flashcards/fc-1', { deckId: 'deck-main' }),
      routeCtx('fc-1'),
    )
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.issues.deckId[0]).toMatch(/subdeck|course main/i)
  })
})

// ─── DELETE /api/flashcards/[id] ──────────────────────────────────────────────

describe('DELETE /api/flashcards/[id]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 401 when unauthenticated', async () => {
    noSession()
    const res = await idDelete(makeRequest('DELETE', 'http://localhost/api/flashcards/fc-1'), routeCtx('fc-1'))
    expect(res.status).toBe(401)
  })

  it('returns 200 with success=true on deletion', async () => {
    adminSession()
    vi.mocked(mockPrisma.flashcard.delete).mockResolvedValue({ id: 'fc-1' } as any)

    const res = await idDelete(makeRequest('DELETE', 'http://localhost/api/flashcards/fc-1'), routeCtx('fc-1'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockPrisma.flashcard.delete).toHaveBeenCalledWith({ where: { id: 'fc-1' } })
  })
})

// ─── POST /api/flashcards/[id]/review ────────────────────────────────────────

describe('POST /api/flashcards/[id]/review', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 401 when unauthenticated', async () => {
    noSession()
    const res = await reviewPost(
      makeRequest('POST', 'http://localhost/api/flashcards/fc-1/review', { answer: 'GOOD' }),
      routeCtx('fc-1'),
    )
    expect(res.status).toBe(401)
  })

  it('returns 400 for an invalid answer value', async () => {
    adminSession()
    vi.mocked(mockPrisma.flashcard.findUnique).mockResolvedValue(MOCK_FLASHCARD as any)
    vi.mocked(mockPrisma.flashcardSettings.upsert).mockResolvedValue(MOCK_SETTINGS as any)

    const res = await reviewPost(
      makeRequest('POST', 'http://localhost/api/flashcards/fc-1/review', { answer: 'INVALID' }),
      routeCtx('fc-1'),
    )
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Validation failed')
  })

  it('returns 404 when flashcard does not exist', async () => {
    adminSession()
    vi.mocked(mockPrisma.flashcard.findUnique).mockResolvedValue(null)
    vi.mocked(mockPrisma.flashcardSettings.upsert).mockResolvedValue(MOCK_SETTINGS as any)

    const res = await reviewPost(
      makeRequest('POST', 'http://localhost/api/flashcards/missing/review', { answer: 'GOOD' }),
      routeCtx('missing'),
    )
    expect(res.status).toBe(404)
  })

  it('applies SRS algorithm: NEW card + GOOD → LEARNING', async () => {
    adminSession()
    vi.mocked(mockPrisma.flashcard.findUnique).mockResolvedValue(MOCK_FLASHCARD as any)
    vi.mocked(mockPrisma.flashcardSettings.upsert).mockResolvedValue(MOCK_SETTINGS as any)
    // No existing per-user progress → bootstrap from card defaults
    vi.mocked(mockPrisma.userFlashcardProgress.findUnique).mockResolvedValue(null)
    vi.mocked(mockPrisma.userFlashcardProgress.create).mockResolvedValue({
      id: 'ufp-1', userId: 'admin-1', flashcardId: 'fc-1',
      state: 'NEW', interval: 0, easeFactor: 2.5, repetition: 0, stepIndex: 0,
      nextReviewAt: null, lastReviewedAt: null, lastResult: null,
      createdAt: new Date(), updatedAt: new Date(),
    } as any)
    vi.mocked(mockPrisma.userFlashcardProgress.update).mockImplementation((args: any) =>
      Promise.resolve({ id: 'ufp-1', ...args.data }),
    )

    const res = await reviewPost(
      makeRequest('POST', 'http://localhost/api/flashcards/fc-1/review', { answer: 'GOOD' }),
      routeCtx('fc-1'),
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    // NEW + GOOD → advances to LEARNING (step 1)
    expect(mockPrisma.userFlashcardProgress.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ state: 'LEARNING', lastResult: 'GOOD' }),
      }),
    )
    expect(data.flashcard).toBeDefined()
    expect(data.flashcard.state).toBe('LEARNING')
  })

  it('applies SRS algorithm: NEW card + EASY → REVIEW', async () => {
    adminSession()
    vi.mocked(mockPrisma.flashcard.findUnique).mockResolvedValue(MOCK_FLASHCARD as any)
    vi.mocked(mockPrisma.flashcardSettings.upsert).mockResolvedValue(MOCK_SETTINGS as any)
    vi.mocked(mockPrisma.userFlashcardProgress.findUnique).mockResolvedValue(null)
    vi.mocked(mockPrisma.userFlashcardProgress.create).mockResolvedValue({
      id: 'ufp-1', userId: 'admin-1', flashcardId: 'fc-1',
      state: 'NEW', interval: 0, easeFactor: 2.5, repetition: 0, stepIndex: 0,
      nextReviewAt: null, lastReviewedAt: null, lastResult: null,
      createdAt: new Date(), updatedAt: new Date(),
    } as any)
    vi.mocked(mockPrisma.userFlashcardProgress.update).mockImplementation((args: any) =>
      Promise.resolve({ id: 'ufp-1', ...args.data }),
    )

    await reviewPost(
      makeRequest('POST', 'http://localhost/api/flashcards/fc-1/review', { answer: 'EASY' }),
      routeCtx('fc-1'),
    )

    expect(mockPrisma.userFlashcardProgress.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ state: 'REVIEW', lastResult: 'EASY' }),
      }),
    )
  })

  it('persists nextReviewAt as a Date in the update call', async () => {
    adminSession()
    vi.mocked(mockPrisma.flashcard.findUnique).mockResolvedValue(MOCK_FLASHCARD as any)
    vi.mocked(mockPrisma.flashcardSettings.upsert).mockResolvedValue(MOCK_SETTINGS as any)
    vi.mocked(mockPrisma.userFlashcardProgress.findUnique).mockResolvedValue(null)
    vi.mocked(mockPrisma.userFlashcardProgress.create).mockResolvedValue({
      id: 'ufp-1', userId: 'admin-1', flashcardId: 'fc-1',
      state: 'NEW', interval: 0, easeFactor: 2.5, repetition: 0, stepIndex: 0,
      nextReviewAt: null, lastReviewedAt: null, lastResult: null,
      createdAt: new Date(), updatedAt: new Date(),
    } as any)
    vi.mocked(mockPrisma.userFlashcardProgress.update).mockResolvedValue({
      id: 'ufp-1', state: 'LEARNING', interval: 0, easeFactor: 2.5,
      repetition: 0, stepIndex: 0, nextReviewAt: new Date(), lastReviewedAt: new Date(),
      lastResult: 'AGAIN',
    } as any)

    await reviewPost(
      makeRequest('POST', 'http://localhost/api/flashcards/fc-1/review', { answer: 'AGAIN' }),
      routeCtx('fc-1'),
    )

    const updateCall = vi.mocked(mockPrisma.userFlashcardProgress.update).mock.calls[0]?.[0] as any
    expect(updateCall.data.nextReviewAt).toBeInstanceOf(Date)
    expect(updateCall.data.lastReviewedAt).toBeInstanceOf(Date)
  })

  it('accepts all valid enum values (AGAIN/HARD/GOOD/EASY)', async () => {
    for (const answer of ['AGAIN', 'HARD', 'GOOD', 'EASY'] as const) {
      vi.clearAllMocks()
      adminSession()
      vi.mocked(mockPrisma.flashcard.findUnique).mockResolvedValue(MOCK_FLASHCARD as any)
      vi.mocked(mockPrisma.flashcardSettings.upsert).mockResolvedValue(MOCK_SETTINGS as any)
      vi.mocked(mockPrisma.userFlashcardProgress.findUnique).mockResolvedValue(null)
      vi.mocked(mockPrisma.userFlashcardProgress.create).mockResolvedValue({
        id: 'ufp-1', userId: 'admin-1', flashcardId: 'fc-1',
        state: 'NEW', interval: 0, easeFactor: 2.5, repetition: 0, stepIndex: 0,
        nextReviewAt: null, lastReviewedAt: null, lastResult: null,
        createdAt: new Date(), updatedAt: new Date(),
      } as any)
      vi.mocked(mockPrisma.userFlashcardProgress.update).mockResolvedValue({
        id: 'ufp-1', state: 'LEARNING',
      } as any)

      const res = await reviewPost(
        makeRequest('POST', `http://localhost/api/flashcards/fc-1/review`, { answer }),
        routeCtx('fc-1'),
      )
      expect(res.status).toBe(200)
    }
  })
})
