/**
 * Payload CMS Migration Runner (Production)
 *
 * This script applies existing migration files to the database.
 * It does NOT use Drizzle push mode (dev-only).
 *
 * Workflow:
 * 1. Dev: Generate migrations with `npm run payload:migrate:create`
 * 2. Commit migration files to src/payload/migrations/
 * 3. Prod: Run `npm run payload:migrate` to apply them
 */

import 'dotenv/config'
import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { MIGRATION_DIR, PROJECT_ROOT } from '../src/payload/paths.ts'
import { pathToFileURL } from 'url'

const { Pool } = pg

type DbWithExecute = {
  execute: (query: unknown) => Promise<unknown>
}

function hasExecute(value: unknown): value is DbWithExecute {
  return !!value && typeof (value as DbWithExecute).execute === 'function'
}

async function migratePayload() {
  // Skip Drizzle push during init
  process.env.PAYLOAD_MIGRATING = 'true'

  console.log('[INFO] Payload CMS Migration Runner (Production Mode)')
  console.log('================================================')

  const databaseUrl =
    process.env.PAYLOAD_DATABASE_URL || process.env.DATABASE_URL

  console.log(
    'PAYLOAD_DATABASE_URL:',
    process.env.PAYLOAD_DATABASE_URL ? 'SET' : 'NOT SET',
  )

  console.log(
    'DATABASE_URL:',
    process.env.DATABASE_URL ? 'SET' : 'NOT SET',
  )

  console.log(
    'PAYLOAD_SECRET:',
    process.env.PAYLOAD_SECRET ? 'SET' : 'NOT SET',
  )

  console.log('Using:', databaseUrl ? 'RESOLVED' : 'NONE')

  if (!databaseUrl) {
    console.error('[ERROR] No database URL set')
    process.exit(1)
  }

  // Validate PAYLOAD_SECRET
  if (!process.env.PAYLOAD_SECRET) {
    console.error('')
    console.error(
      '[ERROR] FATAL: PAYLOAD_SECRET environment variable is not set!',
    )
    console.error('')
    console.error(
      'Payload CMS requires a secret key for JWT signing and encryption.',
    )
    console.error('')
    console.error('[INFO] TO FIX:')
    console.error('   Add PAYLOAD_SECRET to your Vercel environment variables.')
    console.error('   Generate one with: openssl rand -base64 32')
    console.error('')
    process.exit(1)
  }

  if (
    process.env.PAYLOAD_SECRET === 'YOUR-SECRET-HERE' ||
    process.env.PAYLOAD_SECRET.length < 16
  ) {
    console.error('')
    console.error(
      '[ERROR] FATAL: PAYLOAD_SECRET is insecure (too short or default value)!',
    )
    console.error('')
    console.error('[INFO] TO FIX:')
    console.error('   Generate a strong secret: openssl rand -base64 32')
    console.error('')
    process.exit(1)
  }

  // Check migration directory
  console.log('')
  console.log('[INFO] Migration Directory:', MIGRATION_DIR)
  console.log('[INFO] Current Working Directory:', process.cwd())
  console.log('[INFO] PROJECT_ROOT:', PROJECT_ROOT)

  // DEBUG: Check filesystem structure
  console.log('[INFO] DEBUG: Checking filesystem...')

  const srcPath = path.join(PROJECT_ROOT, 'src')

  console.log('[INFO] src exists:', fs.existsSync(srcPath))

  if (fs.existsSync(srcPath)) {
    console.log(
      '[INFO] src contents:',
      fs.readdirSync(srcPath).join(', '),
    )

    const payloadPath = path.join(srcPath, 'payload')

    console.log(
      '[INFO] src/payload exists:',
      fs.existsSync(payloadPath),
    )

    if (fs.existsSync(payloadPath)) {
      console.log(
        '[INFO] src/payload contents:',
        fs.readdirSync(payloadPath).join(', '),
      )
    }
  }

  // Resolve migration directory
  const candidateDirs = [
    MIGRATION_DIR,
    path.join(PROJECT_ROOT, 'src', 'payload', 'migrations'),
    path.join(process.cwd(), 'payload', 'migrations'),
    path.join(process.cwd(), 'src', 'payload', 'migrations'),
  ]

  let resolvedMigrationDir: string | null = null

  for (const d of candidateDirs) {
    if (fs.existsSync(d)) {
      resolvedMigrationDir = d
      break
    }
  }

  if (!resolvedMigrationDir) {
    console.error('[ERROR] Migration directory does not exist!')
    console.error('   Tried locations:')

    candidateDirs.forEach((d) => {
      console.error('     -', d)
    })

    process.exit(1)
  }

  console.log(
    '[INFO] Using migration directory:',
    resolvedMigrationDir,
  )

  const migrationFiles = fs
    .readdirSync(resolvedMigrationDir)
    .filter(
      (f) =>
        f.endsWith('.ts') ||
        f.endsWith('.js'),
    )

  console.log(
    '[INFO] Migration files found:',
    migrationFiles.length,
  )

  if (migrationFiles.length === 0) {
    console.error('')
    console.error('[ERROR] CRITICAL: No migration files found!')
    console.error('')
    console.error(
      '   Expected location:',
      MIGRATION_DIR,
    )
    console.error('')
    console.error('[INFO] TO FIX:')
    console.error(
      '   Generate initial migration:',
    )
    console.error(
      '   npm run payload:migrate:create',
    )
    console.error('')
    console.error(
      '   Migration files must be committed to repo for production deployment.',
    )
    console.error('')

    process.exit(1)
  }

  console.log('[SUCCESS] Found migration files:')

  migrationFiles.forEach((f) => {
    console.log('   -', f)
  })

  const pool = new Pool({
    connectionString: databaseUrl,
  })

  try {
    // ------------------------------------------------------------
    // DATABASE IDENTITY
    // ------------------------------------------------------------

    const identity = await pool.query(`
      SELECT
        current_database() as db,
        current_user as user,
        inet_server_addr() as host,
        inet_server_port() as port,
        current_schema() as schema,
        current_setting('search_path') as search_path
    `)

    console.log('[INFO] MIGRATION connecting to:')
    console.log('   Database:', identity.rows[0].db)
    console.log('   User:', identity.rows[0].user)
    console.log('   Host:', identity.rows[0].host)
    console.log('   Port:', identity.rows[0].port)
    console.log('   Current Schema:', identity.rows[0].schema)
    console.log('   Search Path:', identity.rows[0].search_path)

    // ------------------------------------------------------------
    // PAYLOAD SCHEMA
    // ------------------------------------------------------------

    const schemaCheck = await pool.query(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name = 'payload'
    `)

    console.log(
      '[INFO] Schema "payload" exists:',
      schemaCheck.rows.length > 0,
    )

    if (schemaCheck.rows.length === 0) {
      console.log('[INFO] Creating "payload" schema...')

      await pool.query(
        'CREATE SCHEMA IF NOT EXISTS payload',
      )

      console.log('[SUCCESS] Schema created')
    } else {
      console.log('[INFO] Using existing "payload" schema')
    }

    // ------------------------------------------------------------
    // LESSONS SCHEMA FIX
    // ------------------------------------------------------------

    try {
      console.log(
        '[INFO] Ensuring non-interactive schema fixes...',
      )

      await pool.query(`
        ALTER TABLE IF EXISTS
          "payload"."lessons"
        ADD COLUMN IF NOT EXISTS
          "last_updated_by" integer;
      `)

      console.log(
        '[SUCCESS] Ensured column payload.lessons.last_updated_by',
      )
    } catch (autoErr) {
      console.warn(
        '[WARNING] Failed to apply non-interactive schema fix:',
        autoErr,
      )
    }

    // ------------------------------------------------------------
    // REMOVE LEGACY VIDEO COLUMNS
    // ------------------------------------------------------------

    try {
      console.log(
        '[INFO] Removing legacy video-related columns to avoid interactive prompts...',
      )

      await pool.query(`
        ALTER TABLE IF EXISTS
          "payload"."lessons_blocks_video"
        DROP COLUMN IF EXISTS
          "provider";
      `)

      await pool.query(`
        ALTER TABLE IF EXISTS
          "payload"."lessons"
        DROP COLUMN IF EXISTS
          "video_url";
      `)

      console.log(
        '[SUCCESS] Legacy video columns removed (if present)',
      )
    } catch (dropErr) {
      console.warn(
        '[WARNING] Failed to drop legacy video columns:',
        dropErr,
      )
    }

    // ------------------------------------------------------------
    // TASK TAGS
    // ------------------------------------------------------------

    try {
      console.log(
        '[INFO] Ensuring tasks_tags has name and slug columns...',
      )

      await pool.query(`
        ALTER TABLE IF EXISTS
          "payload"."tasks_tags"
        ADD COLUMN IF NOT EXISTS
          "name" varchar,
        ADD COLUMN IF NOT EXISTS
          "slug" varchar;
      `)

      console.log(
        '[SUCCESS] tasks_tags name/slug columns ensured',
      )
    } catch (tagsErr) {
      console.warn(
        '[WARNING] Failed to ensure tasks_tags columns:',
        tagsErr,
      )
    }

    // ------------------------------------------------------------
    // COURSES ATTRIBUTION COLUMNS
    // ------------------------------------------------------------

    try {
      console.log(
        '[INFO] Ensuring courses has last_updated_by and created_via columns...',
      )

      await pool.query(`
        ALTER TABLE IF EXISTS
          "payload"."courses"
        ADD COLUMN IF NOT EXISTS
          "last_updated_by" varchar;
      `)

      await pool.query(`
        ALTER TABLE IF EXISTS
          "payload"."courses"
        ADD COLUMN IF NOT EXISTS
          "created_via" varchar;
      `)

      console.log(
        '[SUCCESS] courses.last_updated_by + courses.created_via ensured',
      )
    } catch (coursesErr) {
      console.warn(
        '[WARNING] Failed to ensure courses attribution columns:',
        coursesErr,
      )
    }

    // ------------------------------------------------------------
    // SCHEMA PRIVILEGES
    // ------------------------------------------------------------

    const privileges = await pool.query(`
      SELECT
        pg_catalog.has_schema_privilege(
          current_user,
          'payload',
          'USAGE'
        ) as usage,

        pg_catalog.has_schema_privilege(
          current_user,
          'payload',
          'CREATE'
        ) as create
    `)

    console.log(
      '[INFO] DIAGNOSTIC: Schema privileges for current_user on "payload":',
    )

    console.log(
      '   USAGE:',
      privileges.rows[0].usage
        ? '[SUCCESS] YES'
        : '[ERROR] NO',
    )

    console.log(
      '   CREATE:',
      privileges.rows[0].create
        ? '[SUCCESS] YES'
        : '[ERROR] NO',
    )

    // ------------------------------------------------------------
    // INITIALIZE DRIZZLE
    // ------------------------------------------------------------

    console.log('')
    console.log(
      '[INFO] Initializing migration DB adapter...',
    )
    console.log(
      '   Mode: PRODUCTION (using migration files)',
    )

    // ------------------------------------------------------------
    // MANUAL MIGRATION RUNNER
    // ------------------------------------------------------------

    console.log('')
    console.log(
      '[INFO] Applying migration files (manual runner)...',
    )

    try {
      const dbForMigration = drizzle(pool)

      if (!hasExecute(dbForMigration)) {
        throw new Error(
          'Drizzle adapter does not expose execute()',
        )
      }

      // Sort files to ensure deterministic order
      const sorted = migrationFiles
        .slice()
        .sort()

      for (const f of sorted) {
        const full = path.join(
          resolvedMigrationDir,
          f,
        )

        console.log(
          '   → Running migration file:',
          full,
        )

        try {
          const mod = await import(
            pathToFileURL(full).href
          )

          if (typeof mod.up === 'function') {
            await mod.up({
              db: dbForMigration,
              payload: undefined,
              req: undefined,
            })

            console.log(
              '     [SUCCESS] Applied:',
              f,
            )
          } else {
            console.warn(
              '     [WARNING] No `up` export found in:',
              f,
            )
          }
        } catch (err) {
          console.error(
            '     [ERROR] Failed to apply migration',
            f,
            err,
          )

          throw err
        }
      }

      console.log(
        '[SUCCESS] Manual migrations applied successfully',
      )
    } catch (manualErr) {
      console.error(
        '[ERROR] Manual migration runner failed:',
        manualErr,
      )

      throw manualErr
    }

    // ------------------------------------------------------------
    // VERIFY TABLES
    // ------------------------------------------------------------

    console.log('')
    console.log(
      '[INFO] Verifying tables in "payload" schema...',
    )

    const tableCheck = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'payload'
      ORDER BY table_name
    `)

    const allTables = tableCheck.rows.map(
      (r) => r.table_name,
    )

    console.log(
      `[INFO] Found ${allTables.length} tables in "payload" schema:`,
    )

    if (allTables.length > 0) {
      allTables.forEach((t) => {
        console.log(`   - ${t}`)
      })
    } else {
      console.log('   (none)')
    }

    // ------------------------------------------------------------
    // EXPECTED TABLES
    // ------------------------------------------------------------

    const expectedTables = [
      'courses',
      'payload_users',
      'modules',
      'lessons',
      'tasks',
      'tasks_rels',
      'media',
    ]

    const foundTables = new Set(allTables)

    console.log('')
    console.log(
      '[INFO] Expected collection tables:',
    )

    const missingTables: string[] = []

    expectedTables.forEach((table) => {
      const exists = foundTables.has(table)

      console.log(
        `   ${table}: ${
          exists
            ? '[SUCCESS] EXISTS'
            : '[ERROR] MISSING'
        }`,
      )

      if (!exists) {
        missingTables.push(table)
      }
    })

    if (missingTables.length > 0) {
      console.error('')
      console.error(
        '[ERROR] MIGRATION INCOMPLETE: Some tables were not created',
      )

      console.error(
        '   Missing:',
        missingTables.join(', '),
      )

      console.error('')
      console.error(
        '[INFO] POSSIBLE CAUSES:',
      )

      console.error(
        '   1. Migration file does not include these tables',
      )

      console.error(
        '   2. Migration file failed to execute (check logs above)',
      )

      console.error(
        '   3. Collection definitions changed after migration was generated',
      )

      console.error('')
      console.error('[INFO] TO FIX:')

      console.error(
        '   Generate a new migration that includes all collections:',
      )

      console.error(
        '   npm run payload:migrate:create',
      )

      console.error('')

      process.exit(1)
    }

    // ------------------------------------------------------------
    // SUCCESS
    // ------------------------------------------------------------

    console.log('')
    console.log(
      '[SUCCESS] Payload CMS migrations completed successfully',
    )

    console.log(
      '[SUCCESS] All expected tables verified in "payload" schema',
    )

    process.exit(0)
  } catch (error) {
    console.error('')
    console.error(
      '[ERROR] Payload migration failed:',
      error,
    )

    process.exit(1)
  } finally {
    await pool.end()
  }
}

migratePayload()
