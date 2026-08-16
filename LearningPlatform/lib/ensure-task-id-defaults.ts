import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'

/**
 * Self-heal the tasks-family primary keys at runtime.
 *
 * `payload.tasks.id` lost its default during the 2026-02-09 varchar conversion
 * and `payload.tasks_choices.id` was created without one, so Payload's
 * `INSERT ... VALUES (default)` writes NULL into a NOT NULL primary key and
 * every task creation fails. The proper fix is the
 * `2026-08-16_restore_tasks_id_defaults` migration, but Payload migrations are
 * only applied manually (`npm run payload:migrate`) and never run on a Vercel
 * deploy — so we also repair the schema here using Payload's own connection.
 *
 * `ALTER COLUMN ... SET DEFAULT` is idempotent; a module-level flag keeps this
 * to one execution per warm server instance.
 */
let ensured = false

const setUuidDefaultIfVarchar = (table: string) => sql.raw(`
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
`)

export async function ensureTaskIdDefaults(payload: unknown): Promise<void> {
  if (ensured) return
  try {
    const drizzle = (payload as { db?: { drizzle?: { execute: (q: unknown) => Promise<unknown> } } })
      .db?.drizzle
    if (!drizzle) return
    await drizzle.execute(setUuidDefaultIfVarchar('tasks'))
    await drizzle.execute(setUuidDefaultIfVarchar('tasks_choices'))
    ensured = true
  } catch (err) {
    // Non-fatal: if this fails the create will surface its own error.
    logger.error('ensureTaskIdDefaults failed', { error: err })
  }
}
