import 'dotenv/config'
import { getPayload } from 'payload'
import config from './payload.config.js'
import pg from 'pg'
import { logger } from '@/lib/logger'
import bcrypt from 'bcryptjs'
import { sanitizeDatabaseUrl } from '@/lib/db-utils'

const { Pool } = pg

async function seed() {
  logger.info('Starting CMS seed...')

  // Require a seed password from environment — never hard-code credentials
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@example.com'
  // Accounts sign in with an RBX username; derive a default from the email local part.
  const adminUsername = (
    process.env.SEED_ADMIN_USERNAME || adminEmail.split('@')[0] || 'admin'
  )
    .trim()
    .toLowerCase()
  const adminPassword = process.env.SEED_ADMIN_PASSWORD
  if (!adminPassword) {
    logger.error(
      'SEED_ADMIN_PASSWORD environment variable is required to run the seed. ' +
      'Set it in your .env file or Railway environment variables. ' +
      'Generate one with: openssl rand -base64 24'
    )
    process.exit(1)
  }

  const rawUrl = process.env.PAYLOAD_DATABASE_URL || process.env.DATABASE_URL
  const databaseUrl = rawUrl ? sanitizeDatabaseUrl(rawUrl) : undefined
  logger.debug('Environment variables', {
    'PAYLOAD_DATABASE_URL': process.env.PAYLOAD_DATABASE_URL ? 'SET' : 'NOT SET',
    'DATABASE_URL': process.env.DATABASE_URL ? 'SET' : 'NOT SET',
    'Using': databaseUrl ? 'RESOLVED' : 'NONE',
    'PAYLOAD_SECRET': process.env.PAYLOAD_SECRET ? 'SET' : 'NOT SET',
  })
  
  if (!databaseUrl) {
    logger.error('No database URL set')
    process.exit(1)
  }

  // Check if Payload tables exist before attempting to query
  const pool = new Pool({ connectionString: databaseUrl, ssl: databaseUrl.includes('sslmode') ? { rejectUnauthorized: false } : false })
  try {
    // Log DB identity
    const identity = await pool.query(`
      SELECT 
        current_database() as db,
        current_user as user,
        inet_server_addr() as host,
        inet_server_port() as port
    `)
    logger.debug('SEED connecting to', {
      'Database': identity.rows[0].db,
      'User': identity.rows[0].user,
      'Host': identity.rows[0].host,
      'Port': identity.rows[0].port,
    })
    
    // Check table existence
    const result = await pool.query(
      "SELECT to_regclass('payload.payload_users') IS NOT NULL as exists"
    )
    const tablesExist = result.rows[0]?.exists
    
    if (!tablesExist) {
      logger.warning('Payload tables not found - migrations need to run first')
      logger.info('Skipping seed - run payload:migrate then try again')
      await pool.end()
      process.exit(0)
    }
    
    logger.debug('Payload tables exist')
  } catch (error) {
    logger.error(
      'Cannot reach Postgres or inspect Payload tables. Start the database (e.g. Docker Desktop + `docker compose up -d postgres`) and ensure DATABASE_URL matches your host/port.',
      String(error),
    )
    try {
      await pool.end()
    } catch {
      /* ignore */
    }
    process.exit(1)
  } finally {
    try {
      await pool.end()
    } catch {
      /* ignore */
    }
  }

  const payload = await getPayload({ config })

  try {
    logger.info('Creating admin user for CMS...')
    const existingAdmin = await payload.find({
      collection: 'payload-users',
      where: { email: { equals: adminEmail } },
      limit: 1,
    })

    let adminUser
    if (existingAdmin.docs.length > 0) {
      logger.success('Admin user for CMS already exists')
      adminUser = existingAdmin.docs[0]
    } else {
      adminUser = await payload.create({
        collection: 'payload-users',
        data: {
          email: adminEmail,
          password: adminPassword,
          role: 'ADMIN',
        },
      })
      void adminUser
      logger.success('Created admin user for CMS')
    }
    void adminUser

    // Also create admin user for NextAuth (Prisma User table)
    logger.info('Creating admin user for NextAuth...')
    const authPool = new Pool({ connectionString: databaseUrl, ssl: databaseUrl.includes('sslmode') ? { rejectUnauthorized: false } : false })
    try {
      const passwordHash = await bcrypt.hash(adminPassword, 12)
      const authResult = await authPool.query(
        `INSERT INTO public."User" (id, email, username, name, "passwordHash", role, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         ON CONFLICT (email) DO UPDATE SET
           username = COALESCE(public."User".username, EXCLUDED.username),
           "passwordHash" = EXCLUDED."passwordHash",
           role = EXCLUDED.role,
           name = COALESCE(EXCLUDED.name, public."User".name),
           "updatedAt" = NOW()
         RETURNING id, email, username, role`,
        ['admin-001', adminEmail, adminUsername, 'Admin User', passwordHash, 'ADMIN']
      )
      if (authResult.rows.length > 0) {
        logger.success('Admin user for NextAuth ready (created or password synced from SEED_ADMIN_PASSWORD)')
      } else {
        logger.info('Admin NextAuth upsert returned no row (unexpected)')
      }
    } catch (error) {
      // Log the real error clearly so it's visible in Railway logs
      logger.error('Could not create NextAuth user — public."User" table may not exist yet', String(error))
      logger.error('Fix: ensure DATABASE_URL has ?schema=public (not &schema=public) so Prisma migrations target the public schema')
    } finally {
      await authPool.end()
    }
    logger.success('Seed completed - admin user(s) ready')
    process.exit(0)
  } catch (error) {
    logger.error('Seed error', String(error))
    process.exit(1)
  }
}

seed()
