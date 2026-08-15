import type { CollectionConfig } from 'payload'
import { toSlug } from '../../../lib/utils'
import { prisma } from '../../../lib/prisma'
import { deleteModulesAttachingToCourse } from '../lib/content-cascade-delete'
import { sanitizeCoursesMediaRefs } from '@/lib/sanitize-payload-media-refs'

export const Courses: CollectionConfig = {
  slug: 'courses',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'subject', 'level', 'isPublished'],
  },
  hooks: {
    beforeRead: [
      ({ doc }) => {
        sanitizeCoursesMediaRefs(doc)
        return doc
      },
    ],
    beforeDelete: [
      async ({ id, req }) => {
        await deleteModulesAttachingToCourse(req.payload, String(id), req)
      },
    ],
    afterChange: [
      async ({ doc }) => {
        const courseId = String(doc?.id ?? '').trim()
        const courseTitle = typeof doc?.title === 'string' ? doc.title.trim() : ''
        if (!courseId || !courseTitle) return
        try {
          await prisma.flashcardDeck.updateMany({
            where: { courseId, parentDeckId: null },
            data: { name: courseTitle },
          })
        } catch (error) {
          console.error('[Courses.afterChange] failed to sync main deck names', error)
        }
      },
    ],
  },
  access: {
    read: ({ req: { user } }) => {
      if (user?.role === 'ADMIN') return true
      // Students can only read published courses
      return {
        isPublished: {
          equals: true,
        },
      }
    },
    create: ({ req: { user } }) => user?.role === 'ADMIN',
    update: ({ req: { user } }) => user?.role === 'ADMIN',
    delete: ({ req: { user } }) => user?.role === 'ADMIN',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Course title',
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      label: 'Slug (URL)',
      hooks: {
        beforeValidate: [({ data, value }) => {
          const title = typeof data?.title === 'string' ? data.title : ''
          const raw = typeof value === 'string' && value.trim().length > 0 ? value : title
          return raw ? toSlug(raw) : value
        }],
      },
      validate: (val: unknown) => {
        if (!val || typeof val !== 'string') return 'Slug is required'
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(val)) {
          return 'Slug must be lowercase and contain only letters, numbers, and hyphens'
        }
        return true
      },
      admin: {
        description: 'Unique identifier in the URL (e.g., intro-to-web-development)',
      },
    },
    {
      name: 'description',
      type: 'richText',
      label: 'Course description',
    },
    {
      name: 'level',
      type: 'select',
      required: true,
      defaultValue: 'BEGINNER',
      options: [
        {
          label: 'Beginner',
          value: 'BEGINNER',
        },
        {
          label: 'Intermediate',
          value: 'INTERMEDIATE',
        },
        {
          label: 'Advanced',
          value: 'ADVANCED',
        },
      ],
      label: 'Level',
    },
    {
      name: 'subject',
      type: 'relationship',
      relationTo: 'subjects',
      required: true,
      label: 'Subject',
      admin: {
        description: 'Select or create subjects from the dashboard',
      },
    },
    // Removed `topics` field: subjects are managed separately via the Subjects collection
    {
      name: 'coverImage',
      type: 'upload',
      relationTo: 'media',
      label: 'Course cover image',
    },
    {
      name: 'isPublished',
      type: 'checkbox',
      defaultValue: false,
      label: 'Published',
      admin: {
        description: 'Only published courses are visible to learners',
      },
    },
    {
      // Array of Prisma `Group` ids this course is published to.
      // Empty means the course is visible to every student (all groups).
      name: 'publishGroupIds',
      type: 'json',
      label: 'Publish to groups',
      defaultValue: [],
      admin: {
        description:
          'Student group ids this course is visible to. Leave empty to publish to all groups.',
      },
    },
    {
      name: 'lastUpdatedBy',
      type: 'text',
      label: 'Last updated by',
      admin: {
        readOnly: true,
        description: 'Admin email when the course was last saved from the panel; empty if only import touched it.',
      },
    },
    {
      name: 'createdVia',
      type: 'select',
      defaultValue: 'admin',
      label: 'Created via',
      options: [
        { label: 'Admin / UI', value: 'admin' },
        { label: 'Content import', value: 'import' },
      ],
      admin: {
        readOnly: true,
        description: 'How this course was first created.',
      },
    },
  ],
}
