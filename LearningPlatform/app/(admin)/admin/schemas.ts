import { z } from 'zod'

// Course schema
export const courseFormSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  slug: z.string().min(3, 'Slug must be at least 3 characters'),
  description: z.string().optional(),
  subject: z.union([z.string(), z.number()]).transform((val) => String(val)),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
  coverImage: z.union([z.string().min(1), z.literal('')]).optional(),
  // Prisma Group ids this course is published to. Empty = visible to all groups.
  publishGroupIds: z.array(z.string().min(1)).optional(),
  // topics removed; subjects are managed via the Subjects collection
})

// Module schema
export const moduleFormSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  course: z.union([z.string(), z.number()]).transform(String),
  order: z.number().int().positive(),
})

// Lesson schema
export const lessonFormSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  course: z.union([z.string(), z.number()]).transform(String),
  module: z.union([z.string(), z.number()]).transform(String),
  content: z.any().optional(), // Lexical JSON
  order: z.number().int().positive(),
})

// Task schema
export const taskFormSchema = z.object({
  // Accept a single ID, an array of IDs, blank/null/undefined (→ standalone)
  lesson: z.union([
    z.string(),
    z.number(),
    z.array(z.union([z.string(), z.number()])),
    z.literal(''),
    z.null(),
    z.undefined(),
  ])
    .optional()
    .transform((val): string[] | undefined => {
      if (val == null || val === '') return undefined
      if (Array.isArray(val)) {
        const ids = val.map(String).filter(Boolean)
        return ids.length > 0 ? ids : undefined
      }
      const s = String(val)
      return s ? [s] : undefined
    }),
  title: z.string().optional(),
  type: z.enum(['MULTIPLE_CHOICE', 'OPEN_ENDED', 'TRUE_FALSE']),
  prompt: z.union([z.string(), z.any()]).transform((val) => {
    // If it's a string, convert to Lexical format
    if (typeof val === 'string') {
      return {
        root: {
          type: 'root',
          children: [{
            type: 'paragraph',
            children: [{ type: 'text', text: val }]
          }]
        }
      }
    }
    return val
  }),
  choices: z.array(z.string()).optional(),
  correctAnswer: z.string().optional(),
  solution: z.union([z.string(), z.any()]).optional().transform((val) => {
    // Empty/blank → undefined so we never insert "" into the jsonb column
    // (Postgres rejects an empty string as invalid JSON).
    if (val == null || (typeof val === 'string' && val.trim() === '')) return undefined
    // If it's a string, convert to Lexical format
    if (typeof val === 'string') {
      return {
        root: {
          type: 'root',
          children: [{
            type: 'paragraph',
            children: [{ type: 'text', text: val }]
          }]
        }
      }
    }
    return val
  }),
  questionMedia: z.union([z.number(), z.string(), z.null()]).optional().nullable().transform(val => {
    // Media IDs are varchar UUIDs in Payload CMS, keep as strings
    if (val === null || val === undefined || val === '') return null
    return String(val)  // Always convert to string for Payload UUID
  }),
  solutionMedia: z.union([z.number(), z.string(), z.null()]).optional().nullable().transform(val => {
    // Media IDs are varchar UUIDs in Payload CMS, keep as strings
    if (val === null || val === undefined || val === '') return null
    return String(val)  // Always convert to string for Payload UUID
  }),
  solutionVideoUrl: z.string().url().optional().or(z.literal('')),
  points: z.number().int().positive().default(1),
  order: z.number().int().positive(),
  autoGrade: z.boolean().optional().default(false),
  tags: z.array(z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
  })).optional(),
})
