import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true, // Public media access for images in courses
    create: ({ req: { user } }) => user?.role === 'ADMIN',
    update: ({ req: { user } }) => user?.role === 'ADMIN',
    delete: ({ req: { user } }) => user?.role === 'ADMIN',
  },
  upload: {
    staticDir: 'public/media',
    // Files are stored by the upload routes themselves (S3 in production, or
    // public/media locally in dev) and served via /api/media/serve. Disabling
    // Payload's own local storage stops it from reading/writing the file on the
    // serverless (read-only) filesystem, which otherwise throws ENOENT.
    disableLocalStorage: true,
    mimeTypes: ['image/*', 'video/*', 'application/pdf'],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      label: 'Tekst alternatywny',
    },
  ],
}
