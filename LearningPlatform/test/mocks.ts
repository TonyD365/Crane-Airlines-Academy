import { vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'

/**
 * Mock Prisma Client for testing without database connection
 * Provides chainable API that matches Prisma's interface
 */

// Helper to create a mock result
const createMockResult = (data: any) => Promise.resolve(data)

// Create a comprehensive mock Prisma client
export const createMockPrisma = (overrides = {}) => {
  const mockPrisma = {
    // User operations
    user: {
      create: vi.fn((args) => createMockResult({ id: 'mock-user-id', ...args.data })),
      findUnique: vi.fn(() => createMockResult(null)),
      findFirst: vi.fn(() => createMockResult(null)),
      findMany: vi.fn(() => createMockResult([])),
      update: vi.fn((args) => createMockResult({ id: args.where.id, ...args.data })),
      delete: vi.fn((args) => createMockResult({ id: args.where.id })),
      upsert: vi.fn((args) => createMockResult({ id: 'mock-id', ...args.create })),
      count: vi.fn(() => createMockResult(0)),
    },
    
    // CourseProgress operations
    courseProgress: {
      create: vi.fn((args) => createMockResult({ id: 'mock-progress-id', ...args.data })),
      findUnique: vi.fn(() => createMockResult(null)),
      findFirst: vi.fn(() => createMockResult(null)),
      findMany: vi.fn(() => createMockResult([])),
      update: vi.fn((args) => createMockResult({ id: args.where.id, ...args.data })),
      delete: vi.fn((args) => createMockResult({ id: args.where.id })),
      upsert: vi.fn((args) => createMockResult({ id: 'mock-id', ...args.create })),
      count: vi.fn(() => createMockResult(0)),
      aggregate: vi.fn(() => createMockResult({ _sum: { earnedPoints: 0 } })),
    },

    userStandaloneFlashcardDeck: {
      create: vi.fn((args) => createMockResult({ ...args.data })),
      findUnique: vi.fn(() => createMockResult(null)),
      findFirst: vi.fn(() => createMockResult(null)),
      findMany: vi.fn(() => createMockResult([])),
      upsert: vi.fn((args) => createMockResult({ ...args.create })),
      delete: vi.fn(() => createMockResult({})),
      deleteMany: vi.fn(() => createMockResult({ count: 0 })),
      count: vi.fn(() => createMockResult(0)),
    },
    
    // LessonProgress operations
    lessonProgress: {
      create: vi.fn((args) => createMockResult({ id: 'mock-lesson-progress-id', ...args.data })),
      findUnique: vi.fn(() => createMockResult(null)),
      findFirst: vi.fn(() => createMockResult(null)),
      findMany: vi.fn(() => createMockResult([])),
      update: vi.fn((args) => createMockResult({ id: args.where.id, ...args.data })),
      delete: vi.fn((args) => createMockResult({ id: args.where.id })),
      upsert: vi.fn((args) => createMockResult({ 
        id: 'mock-id', 
        userId: 'mock-user-id',
        lessonId: 'mock-lesson-id',
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        ...args.create 
      })),
      count: vi.fn(() => createMockResult(0)),
      deleteMany: vi.fn(() => createMockResult({ count: 0 })),
      aggregate: vi.fn(() => createMockResult({ _count: { _all: 0 } })),
    },
    
    // TaskProgress operations
    taskProgress: {
      create: vi.fn((args) => createMockResult({ id: 'mock-task-progress-id', ...args.data })),
      findUnique: vi.fn(() => createMockResult(null)),
      findFirst: vi.fn(() => createMockResult(null)),
      findMany: vi.fn(() => createMockResult([])),
      update: vi.fn((args) => createMockResult({ id: args.where.id, ...args.data })),
      delete: vi.fn((args) => createMockResult({ id: args.where.id })),
      upsert: vi.fn((args) => createMockResult({ 
        id: 'mock-id',
        userId: 'mock-user-id',
        taskId: 'mock-task-id',
        lessonProgressId: 'mock-lesson-progress-id',
        submittedAnswer: '',
        earnedPoints: 0,
        maxPoints: 10,
        isCorrect: false,
        status: 'ATTEMPTED',
        attemptedAt: new Date(),
        ...args.create 
      })),
      count: vi.fn(() => createMockResult(0)),
      deleteMany: vi.fn(() => createMockResult({ count: 0 })),
      aggregate: vi.fn(() => createMockResult({ 
        _sum: { earnedPoints: 0, maxPoints: 0 },
        _count: { _all: 0 }
      })),
    },
    
    // FlashcardDeck operations
    flashcardDeck: {
      create:     vi.fn((args) => createMockResult({ id: 'mock-deck-id', tags: [], ...args.data })),
      findUnique: vi.fn(() => createMockResult(null)),
      findFirst:  vi.fn(() => createMockResult(null)),
      findMany:   vi.fn(() => createMockResult([])),
      update:     vi.fn((args) => createMockResult({ id: args.where.id, tags: [], ...args.data })),
      delete:     vi.fn((args) => createMockResult({ id: args.where.id })),
      deleteMany: vi.fn(() => createMockResult({ count: 0 })),
      upsert:     vi.fn((args) => createMockResult({ id: 'mock-id', ...args.create })),
      count:      vi.fn(() => createMockResult(0)),
    },

    // Flashcard operations
    flashcard: {
      create:     vi.fn((args) => createMockResult({ id: 'mock-flashcard-id', tags: [], ...args.data })),
      findUnique: vi.fn(() => createMockResult(null)),
      findFirst:  vi.fn(() => createMockResult(null)),
      findMany:   vi.fn(() => createMockResult([])),
      update:     vi.fn((args) => createMockResult({ id: args.where.id, tags: [], ...args.data })),
      delete:     vi.fn((args) => createMockResult({ id: args.where.id })),
      deleteMany: vi.fn(() => createMockResult({ count: 0 })),
      upsert:     vi.fn((args) => createMockResult({ id: 'mock-id', ...args.create })),
      count:      vi.fn(() => createMockResult(0)),
    },

    // Tag operations
    tag: {
      create:     vi.fn((args) => createMockResult({ id: 'mock-tag-id', ...args.data })),
      findUnique: vi.fn(() => createMockResult(null)),
      findFirst:  vi.fn(() => createMockResult(null)),
      findMany:   vi.fn(() => createMockResult([])),
      update:     vi.fn((args) => createMockResult({ id: args.where.id, ...args.data })),
      delete:     vi.fn((args) => createMockResult({ id: args.where.id })),
      upsert:     vi.fn((args) => createMockResult({ id: 'mock-id', ...args.create })),
      count:      vi.fn(() => createMockResult(0)),
    },

    // FlashcardSettings operations
    flashcardSettings: {
      create:     vi.fn((args) => createMockResult({ id: 'mock-settings-id', ...args.data })),
      findUnique: vi.fn(() => createMockResult(null)),
      findFirst:  vi.fn(() => createMockResult(null)),
      findMany:   vi.fn(() => createMockResult([])),
      update:     vi.fn((args) => createMockResult({ id: args.where.id, ...args.data })),
      delete:     vi.fn((args) => createMockResult({ id: args.where.id })),
      upsert: vi.fn((args) =>
        createMockResult({
          id:                 'mock-settings-id',
          userId:             args.create?.userId ?? 'mock-user-id',
          newCardsPerDay:     20,
          maxReviews:         200,
          learningSteps:      '1 10',
          relearningSteps:    '10',
          graduatingInterval: 1,
          easyInterval:       4,
          startingEase:       2.5,
          masteredThreshold:  21,
          ...args.create,
        }),
      ),
      count:      vi.fn(() => createMockResult(0)),
    },

    // UserFlashcardProgress operations (per-user SRS state)
    userFlashcardProgress: {
      create:     vi.fn((args) => createMockResult({
        id: 'mock-ufp-id', userId: 'mock-user-id', flashcardId: 'mock-flashcard-id',
        state: 'NEW', stepIndex: 0, interval: 0, easeFactor: 2.5, repetition: 0,
        nextReviewAt: null, lastReviewedAt: null, lastResult: null,
        createdAt: new Date(), updatedAt: new Date(),
        ...args.data,
      })),
      findUnique: vi.fn(() => createMockResult(null)),
      findFirst:  vi.fn(() => createMockResult(null)),
      findMany:   vi.fn(() => createMockResult([])),
      update:     vi.fn((args) => createMockResult({
        id: args.where.id ?? 'mock-ufp-id', state: 'NEW', interval: 0, easeFactor: 2.5,
        repetition: 0, stepIndex: 0, nextReviewAt: null, lastReviewedAt: null, lastResult: null,
        ...args.data,
      })),
      delete:     vi.fn((args) => createMockResult({ id: args.where.id })),
      upsert:     vi.fn((args) => createMockResult({
        id: 'mock-ufp-id', userId: 'mock-user-id', flashcardId: 'mock-flashcard-id',
        state: 'NEW', stepIndex: 0, interval: 0, easeFactor: 2.5, repetition: 0,
        nextReviewAt: null, lastReviewedAt: null, lastResult: null,
        ...args.create,
      })),
      count:      vi.fn(() => createMockResult(0)),
      deleteMany: vi.fn(() => createMockResult({ count: 0 })),
    },

    // TaskProgressTag operations (normalised tag-progress join)
    taskProgressTag: {
      create:     vi.fn((args) => createMockResult({ id: 'mock-tpt-id', ...args.data })),
      findUnique: vi.fn(() => createMockResult(null)),
      findFirst:  vi.fn(() => createMockResult(null)),
      findMany:   vi.fn(() => createMockResult([])),
      update:     vi.fn((args) => createMockResult({ id: args.where.id, ...args.data })),
      delete:     vi.fn((args) => createMockResult({ id: args.where.id })),
      upsert:     vi.fn((args) => createMockResult({ id: 'mock-tpt-id', ...args.create })),
      count:      vi.fn(() => createMockResult(0)),
      deleteMany: vi.fn(() => createMockResult({ count: 0 })),
    },

    // TaskAttempt operations (append-only task submission log)
    taskAttempt: {
      create: vi.fn((args) => createMockResult({
        id: 'mock-task-attempt-id',
        userId: 'mock-user-id',
        taskId: 'mock-task-id',
        lessonProgressId: 'mock-lesson-progress-id',
        taskProgressId: 'mock-task-progress-id',
        submittedAnswer: '',
        earnedPoints: 0,
        maxPoints: 10,
        isCorrect: false,
        difficultyRating: null,
        attemptedAt: new Date(),
        createdAt: new Date(),
        ...args.data,
      })),
      findUnique: vi.fn(() => createMockResult(null)),
      findFirst: vi.fn(() => createMockResult(null)),
      findMany: vi.fn(() => createMockResult([])),
      groupBy: vi.fn(() => createMockResult([])),
      update: vi.fn((args) => createMockResult({ id: args.where.id, ...args.data })),
      delete: vi.fn((args) => createMockResult({ id: args.where.id })),
      upsert: vi.fn((args) => createMockResult({
        id: 'mock-task-attempt-id',
        ...args.create,
      })),
      count: vi.fn(() => createMockResult(0)),
      deleteMany: vi.fn(() => createMockResult({ count: 0 })),
    },

    // TaskAttemptTag operations (normalised tag-attempt join)
    taskAttemptTag: {
      create: vi.fn((args) => createMockResult({ id: 'mock-tat-id', ...args.data })),
      createMany: vi.fn((args) => createMockResult({ count: args?.data?.length ?? 0 })),
      findUnique: vi.fn(() => createMockResult(null)),
      findFirst: vi.fn(() => createMockResult(null)),
      findMany: vi.fn(() => createMockResult([])),
      update: vi.fn((args) => createMockResult({ id: args.where.id, ...args.data })),
      delete: vi.fn((args) => createMockResult({ id: args.where.id })),
      upsert: vi.fn((args) => createMockResult({ id: 'mock-tat-id', ...args.create })),
      count: vi.fn(() => createMockResult(0)),
      deleteMany: vi.fn(() => createMockResult({ count: 0 })),
    },

    // ActivityLog operations
    activityLog: {
      create:     vi.fn((args) => createMockResult({ id: 'mock-activity-log-id', ...args.data })),
      findUnique: vi.fn(() => createMockResult(null)),
      findFirst:  vi.fn(() => createMockResult(null)),
      findMany:   vi.fn(() => createMockResult([])),
      update:     vi.fn((args) => createMockResult({ id: args.where.id, ...args.data })),
      delete:     vi.fn((args) => createMockResult({ id: args.where.id })),
      count:      vi.fn(() => createMockResult(0)),
      deleteMany: vi.fn(() => createMockResult({ count: 0 })),
    },

    platformFlags: {
      findUnique: vi.fn(() => createMockResult(null)),
      upsert: vi.fn((args) =>
        createMockResult({
          id: args.where.id,
          activityLoggingEnabled: args.create?.activityLoggingEnabled ?? args.update?.activityLoggingEnabled ?? true,
        }),
      ),
    },

    creativeSpace: {
      findMany: vi.fn(() => createMockResult([])),
      findFirst: vi.fn(() => createMockResult(null)),
      create: vi.fn((args) =>
        createMockResult({
          id: 'mock-creative-space-id',
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastEditedAt: new Date(),
        }),
      ),
      update: vi.fn((args) => createMockResult({ id: args.where.id, ...args.data })),
      delete: vi.fn((args) => createMockResult({ id: args.where.id })),
    },

    creativeItem: {
      findMany: vi.fn(() => createMockResult([])),
      findFirst: vi.fn(() => createMockResult(null)),
      create: vi.fn((args) =>
        createMockResult({
          id: 'mock-creative-item-id',
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ),
      aggregate: vi.fn(() => createMockResult({ _max: { zIndex: 0 as number | null } })),
    },

    creativeActivityEvent: {
      create: vi.fn((args) => createMockResult({ id: 'mock-activity-id', ...args.data })),
    },

    // RevokedToken operations (JWT blocklist)
    revokedToken: {
      create:     vi.fn((args) => createMockResult({ id: 'mock-revoked-token-id', ...args.data })),
      findUnique: vi.fn(() => createMockResult(null)),
      findFirst:  vi.fn(() => createMockResult(null)),
      findMany:   vi.fn(() => createMockResult([])),
      update:     vi.fn((args) => createMockResult({ id: args.where.id, ...args.data })),
      delete:     vi.fn((args) => createMockResult({ id: args.where.id })),
      upsert:     vi.fn((args) => createMockResult({ id: 'mock-id', ...args.create })),
      count:      vi.fn(() => createMockResult(0)),
      deleteMany: vi.fn(() => createMockResult({ count: 0 })),
    },

    // Transaction support
    $transaction: vi.fn((callback) => {
      if (typeof callback === 'function') {
        return callback(mockPrisma)
      }
      return Promise.all(callback)
    }),
    
    // Raw query support
    $queryRaw: vi.fn(() => createMockResult([])),
    $executeRaw: vi.fn(() => createMockResult(0)),
    
    // Connection management
    $connect: vi.fn(() => Promise.resolve()),
    $disconnect: vi.fn(() => Promise.resolve()),
    
    // Apply any custom overrides
    ...overrides,
  }
  
  return mockPrisma as unknown as PrismaClient
}

/**
 * Mock Payload CMS for testing
 */
export const createMockPayload = (overrides = {}) => {
  return {
    findByID: vi.fn(async ({ collection, id }) => {
      // Default responses for common collections
      if (collection === 'tasks') {
        return {
          id,
          type: 'MULTIPLE_CHOICE',
          question: 'Test question?',
          correctAnswer: 'A',
          points: 10,
          isPublished: true,
          tags: [],
        }
      }
      if (collection === 'lessons') {
        return {
          id,
          title: 'Test Lesson',
          course: 'mock-course-id',
          isPublished: true,
        }
      }
      if (collection === 'courses') {
        return {
          id,
          slug: 'test-course',
          title: 'Test Course',
          isPublished: true,
        }
      }
      return null
    }),
    
    find: vi.fn(async ({ collection }) => {
      return {
        docs: [],
        totalDocs: 0,
        limit: 10,
        page: 1,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      }
    }),
    
    create: vi.fn(async ({ collection, data }) => {
      return { id: 'mock-created-id', ...data }
    }),
    
    update: vi.fn(async ({ collection, id, data }) => {
      return { id, ...data }
    }),
    
    delete: vi.fn(async ({ collection, id }) => {
      return { id }
    }),
    
    ...overrides,
  }
}

/**
 * Mock NextAuth session
 */
export const createMockSession = (
  role: 'STUDENT' | 'TRAINER' | 'MANAGER' | 'PRESIDENT' = 'STUDENT',
  overrides = {},
) => {
  return {
    user: {
      id: 'mock-user-id',
      email: 'test@example.com',
      name: 'Test User',
      role,
      ...overrides,
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  }
}

/**
 * Mock Next.js Request
 */
export const createMockRequest = (url: string, options: RequestInit = {}) => {
  return new Request(url, {
    method: 'GET',
    headers: new Headers({
      'content-type': 'application/json',
      ...options.headers,
    }),
    ...options,
  })
}

/**
 * Reset all mocks (call in beforeEach)
 */
export const resetAllMocks = (mockPrisma: any, mockPayload?: any) => {
  // Reset Prisma mocks
  Object.keys(mockPrisma).forEach(key => {
    if (mockPrisma[key] && typeof mockPrisma[key] === 'object') {
      Object.keys(mockPrisma[key]).forEach(method => {
        if (vi.isMockFunction(mockPrisma[key][method])) {
          mockPrisma[key][method].mockClear()
        }
      })
    }
  })
  
  // Reset Payload mocks
  if (mockPayload) {
    Object.keys(mockPayload).forEach(key => {
      if (vi.isMockFunction(mockPayload[key])) {
        mockPayload[key].mockClear()
      }
    })
  }
}
