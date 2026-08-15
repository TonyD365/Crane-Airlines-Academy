import { describe, it, expect, vi, beforeEach } from 'vitest'
import { requireAuth, requireAdmin } from '@/lib/auth-helpers'
import type { Role } from '@prisma/client'

// Mock the auth module
vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

const { auth } = await import('@/auth')
const mockedAuth = vi.mocked(auth)

describe('auth-helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('requireAuth', () => {
    it('should return user data when session is valid', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'STUDENT' as Role,
      }

      mockedAuth.mockResolvedValueOnce({
        user: mockUser,
      } as any)

      const result = await requireAuth()

      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'STUDENT',
        isPro: false,
      })
    })

    it('should throw error when session is null', async () => {
      mockedAuth.mockResolvedValueOnce(null)

      await expect(requireAuth()).rejects.toThrow('Unauthorized')
    })

    it('should throw error when user.id is missing', async () => {
      mockedAuth.mockResolvedValueOnce({
        user: {
          email: 'test@example.com',
          role: 'STUDENT' as Role,
        },
      } as any)

      await expect(requireAuth()).rejects.toThrow('Unauthorized')
    })

    it('should throw error when user.email is missing', async () => {
      mockedAuth.mockResolvedValueOnce({
        user: {
          id: 'user-123',
          role: 'STUDENT' as Role,
        },
      } as any)

      await expect(requireAuth()).rejects.toThrow('Unauthorized')
    })

    it('should throw error when user.role is missing', async () => {
      mockedAuth.mockResolvedValueOnce({
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      } as any)

      await expect(requireAuth()).rejects.toThrow('Unauthorized')
    })

    it('should handle user without name field', async () => {
      mockedAuth.mockResolvedValueOnce({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'STUDENT' as Role,
        },
      } as any)

      const result = await requireAuth()

      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        name: undefined,
        role: 'STUDENT',
        isPro: false,
      })
    })

    it('should map isPro true when session user is pro', async () => {
      mockedAuth.mockResolvedValueOnce({
        user: {
          id: 'user-123',
          email: 'pro@example.com',
          name: 'Pro User',
          role: 'STUDENT' as Role,
          isPro: true,
        },
      } as any)

      const result = await requireAuth()

      expect(result).toEqual({
        id: 'user-123',
        email: 'pro@example.com',
        name: 'Pro User',
        role: 'STUDENT',
        isPro: true,
      })
    })

    it('should accept different role types', async () => {
      for (const role of ['STUDENT', 'PRESIDENT'] as Role[]) {
        mockedAuth.mockResolvedValueOnce({
          user: {
            id: 'user-123',
            email: 'test@example.com',
            role,
          },
        } as any)

        const result = await requireAuth()
        expect(result.role).toBe(role)
      }
    })
  })

  describe('requireAdmin', () => {
    it('should return user data when user is admin', async () => {
      mockedAuth.mockResolvedValueOnce({
        user: {
          id: 'admin-123',
          email: 'admin@example.com',
          name: 'Admin User',
          role: 'PRESIDENT' as Role,
        },
      } as any)

      const result = await requireAdmin()

      expect(result).toEqual({
        id: 'admin-123',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'PRESIDENT',
        isPro: false,
      })
    })

    it('should throw Forbidden when user is student', async () => {
      mockedAuth.mockResolvedValueOnce({
        user: {
          id: 'user-123',
          email: 'student@example.com',
          role: 'STUDENT' as Role,
        },
      } as any)

      await expect(requireAdmin()).rejects.toThrow('Forbidden')
    })

    it('should throw Unauthorized when session is null', async () => {
      mockedAuth.mockResolvedValueOnce(null)

      await expect(requireAdmin()).rejects.toThrow('Unauthorized')
    })

    it('should throw Unauthorized when user.id is missing', async () => {
      mockedAuth.mockResolvedValueOnce({
        user: {
          email: 'admin@example.com',
          role: 'PRESIDENT' as Role,
        },
      } as any)

      await expect(requireAdmin()).rejects.toThrow('Unauthorized')
    })

    it('should reject non-manager roles', async () => {
      // requireAdmin now means Manager or President; Student and Trainer are rejected.
      const nonAdminRoles: Role[] = ['STUDENT', 'TRAINER']

      for (const role of nonAdminRoles) {
        mockedAuth.mockResolvedValueOnce({
          user: {
            id: 'user-123',
            email: 'user@example.com',
            role,
          },
        } as any)

        await expect(requireAdmin()).rejects.toThrow('Forbidden')
      }
    })
  })
})
