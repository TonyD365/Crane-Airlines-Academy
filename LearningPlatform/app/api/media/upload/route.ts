import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { randomBytes } from 'crypto'
import { uploadBufferToS3, isS3Configured } from '@/lib/s3'
import { requireAdmin } from '@/lib/auth-helpers'
import { logActivity, ActivityAction } from '@/lib/activity-log'

/**
 * Validates that a buffer starts with a recognised image magic-byte sequence.
 * Supported formats: JPEG, PNG, GIF, WebP, BMP, TIFF.
 * This guards against spoofed Content-Type headers.
 */
function hasValidImageMagicBytes(buf: Buffer): boolean {
  if (buf.length < 12) return false
  // JPEG: FF D8 FF
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return true
  // PNG:  89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return true
  // GIF:  47 49 46 38 (GIF8)
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true
  // WebP: RIFF????WEBP
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return true
  // BMP:  42 4D
  if (buf[0] === 0x42 && buf[1] === 0x4D) return true
  // TIFF: little-endian (49 49 2A 00) or big-endian (4D 4D 00 2A)
  if (buf[0] === 0x49 && buf[1] === 0x49 && buf[2] === 0x2A && buf[3] === 0x00) return true
  if (buf[0] === 0x4D && buf[1] === 0x4D && buf[2] === 0x00 && buf[3] === 0x2A) return true
  return false
}

export async function POST(request: NextRequest) {
  try {
    // Explicit auth guard — do not rely on middleware alone
    const admin = await requireAdmin()
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }

    // Enforce maximum upload size (10 MB) before reading the full buffer
    const MAX_FILE_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File exceeds maximum allowed size of 10 MB' }, { status: 413 })
    }

    const sanitize = (name: string) => {
      return name
        .normalize('NFKD')
        .replace(/\s+/g, '-')
        .replace(/[^A-Za-z0-9._\-()]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
    }

    const originalName = file.name || 'upload'
    const safeName = sanitize(originalName)

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Validate file content via magic bytes — the Content-Type header is
    // client-supplied and can be spoofed.  This check inspects the actual
    // binary signature of the uploaded data.
    if (!hasValidImageMagicBytes(buffer)) {
      return NextResponse.json({ error: 'File content does not match a supported image format' }, { status: 400 })
    }

    const ext = path.extname(safeName)
    const base = path.basename(safeName, ext) || 'upload'

    let finalName = safeName
    let remoteKey: string | null = null

    if (isS3Configured()) {
      // Production (Vercel/Railway): store in object storage only. The serverless
      // filesystem is read-only, so we never touch public/media here. A random
      // suffix guarantees a unique key without a disk or bucket existence check.
      finalName = `${base}-${randomBytes(4).toString('hex')}${ext}`
      remoteKey = await uploadBufferToS3(buffer, finalName, file.type)
      if (!remoteKey) {
        return NextResponse.json({ error: 'Failed to store file' }, { status: 500 })
      }
    } else {
      // Local/dev only: no object storage configured — write to public/media so
      // Next can serve it. Requires a writable filesystem (not available on Vercel).
      const publicDir = path.join(process.cwd(), 'public', 'media')
      try {
        if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true })
        let attempt = 0
        while (fs.existsSync(path.join(publicDir, finalName))) {
          attempt += 1
          finalName = `${base}-${attempt}${ext}`
        }
        fs.writeFileSync(path.join(publicDir, finalName), buffer)
      } catch (err) {
        console.error('[ERROR] Local media write failed and no S3 is configured:', err)
        return NextResponse.json(
          {
            error:
              'File storage is not configured. On serverless hosting (e.g. Vercel) the filesystem is read-only — configure S3 storage (S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) to upload media.',
          },
          { status: 500 },
        )
      }
    }

    // Create Payload media record with metadata only (no file buffer to avoid body-lock)
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    const payload = await getPayload({ config })
    
    // ALWAYS use our serve endpoint as the stored URL.
    // /api/media/serve/[key] handles both S3 (via signed URL redirect) and local disk.
    // Never store raw S3 URLs - buckets are private and signed URLs expire.
    const publicUrl = `/api/media/serve/${encodeURIComponent(finalName)}`
    
    const media = await payload.create({
      collection: 'media',
      data: {
        filename: finalName,
        mimeType: file.type,
        filesize: buffer.length,
        alt: originalName,
        url: publicUrl,
      },
    })

    console.log(`[SUCCESS] Upload successful: ${finalName} (${buffer.length} bytes) -> ${remoteKey ? 'S3' : 'local'} ${publicUrl}`)

    logActivity({
      action:       ActivityAction.MEDIA_UPLOADED,
      actorUserId:  admin.id,
      actorEmail:   admin.email,
      resourceType: 'media',
      resourceId:   String(media.id),
      metadata:     { filename: finalName, mimeType: file.type, filesize: buffer.length, url: publicUrl },
    })

    return NextResponse.json({
      success: true, 
      url: publicUrl, 
      id: media.id, 
      filename: finalName 
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message === 'Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: error.message === 'Unauthorized' ? 401 : 403 })
    }
    console.error('[ERROR] Upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
