import { Pool } from 'pg'
import { logger } from '@/lib/logger'

/**
 * Self-heal the tasks-family primary keys at runtime.
 *
 * `payload.tasks.id` lost its default during the 2026-02-09 varchar conversion
 * and `payload.tasks_choices.id` was created without one, so Payload's
 * `INSERT ... VALUES (default)` writes NULL into a NOT NULL primary key and
 * every task creation fails. Payload (uuid idType) strips any client-supplied
 * `id`, so the value must come from a DB column default.
 *
 * The proper fix is the `2026-08-16_restore_tasks_id_defaults` migration, but
 * Payload migrations are only applied manually (`npm run payload:migrate`) and
 * never run on a Vercel deploy. So we repair the schema here with a direct pg
 * connection using the same (owner) credentials the migrations use.
 *
 * `ALTER COLUMN ... SET DEFAULT` is idempotent; a module-level flag keeps this
 * to one execution per warm server instance.
 */
let ensured = false

const setDefaultSql = (table: string) => `
  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'payload'
        AND table_name = '${table}'
        AND column_name = 'id'
        AND data_type = 'character varying'
    ) THEN
      EXECUTE 'ALTER TABLE "payload"."${table}" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::varchar';
    END IF;
  END $$;
`

export async function ensureTaskIdDefaults(): Promise<void> {
  if (ensured) return

  const connectionString =
    process.env.PAYLOAD_DATABASE_URL || process.env.DATABASE_URL
  if (!connectionString) {
    logger.error('ensureTaskIdDefaults: no database URL in env')
    return
  }

  const pool = new Pool({ connectionString, max: 1 })
  try {
    await pool.query(setDefaultSql('tasks'))
    await pool.query(setDefaultSql('tasks_choices'))
    ensured = true
    logger.info('ensureTaskIdDefaults: tasks/tasks_choices id defaults ensured')
  } catch (err) {
    // Surface the real Postgres error (permissions, etc.) so it is diagnosable;
    // still non-fatal so createTask can attempt (and report) its own error.
    logger.error('ensureTaskIdDefaults failed', {
      message: err instanceof Error ? err.message : String(err),
    })
  } finally {
    await pool.end().catch(() => {})
  }
}
