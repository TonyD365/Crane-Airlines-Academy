import { Pool } from 'pg'
import { logger } from '@/lib/logger'

/**
 * Self-heal the tasks-family primary keys at runtime.
 *
 * `payload.tasks.id` lost its column default during the 2026-02-09 varchar
 * conversion and `payload.tasks_choices.id` was created without one, so
 * Payload's `INSERT ... VALUES (default)` writes NULL into a NOT NULL primary
 * key and every task creation fails. Payload (uuid idType) strips any
 * client-supplied `id`, so the value must come from a DB column default.
 *
 * The `2026-08-16_restore_tasks_id_defaults` migration fixes this, but Payload
 * migrations only run manually (`npm run payload:migrate`), never on a Vercel
 * deploy. So we repair the schema here with a direct pg connection using the
 * same (owner) credentials the migrations use. `ALTER COLUMN ... SET DEFAULT`
 * is a global, idempotent change: one success permanently fixes production.
 *
 * Logs are emitted `critical` so they survive without VERBOSE_LOGGING.
 * A module-level flag keeps this to one execution per warm server instance.
 */
let ensured = false

const TABLES = ['tasks', 'tasks_choices'] as const

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
    for (const table of TABLES) {
      const { rows } = await pool.query(
        `SELECT data_type, column_default
           FROM information_schema.columns
          WHERE table_schema = 'payload'
            AND table_name = $1
            AND column_name = 'id'`,
        [table],
      )
      const info = rows[0] as { data_type?: string; column_default?: string } | undefined
      logger.info(
        `ensureTaskIdDefaults[${table}] type=${info?.data_type ?? 'MISSING'} default=${info?.column_default ?? 'NONE'}`,
        undefined,
        true,
      )
      if (!info?.data_type) continue

      // Pick a default expression that matches the column's real type.
      let expr: string | null = null
      if (info.data_type === 'uuid') expr = 'gen_random_uuid()'
      else if (info.data_type === 'character varying' || info.data_type === 'text') {
        expr = 'gen_random_uuid()::varchar'
      }

      if (!expr) {
        logger.error(
          `ensureTaskIdDefaults[${table}] unexpected id type "${info.data_type}" — cannot set a uuid default`,
        )
        continue
      }

      await pool.query(
        `ALTER TABLE "payload"."${table}" ALTER COLUMN "id" SET DEFAULT ${expr}`,
      )
      logger.info(`ensureTaskIdDefaults[${table}] default set to ${expr}`, undefined, true)
    }
    ensured = true
  } catch (err) {
    logger.error('ensureTaskIdDefaults failed', {
      message: err instanceof Error ? err.message : String(err),
    })
  } finally {
    await pool.end().catch(() => {})
  }
}
