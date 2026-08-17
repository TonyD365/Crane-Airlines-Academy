import { Pool } from 'pg'
import { logger } from '@/lib/logger'

/**
 * Self-heal the payload.tasks schema at runtime so task creation works even
 * though Payload migrations are never applied on a Vercel deploy (they only run
 * via a manual `npm run payload:migrate`).
 *
 * Root cause of "Failed to create task": the Tasks collection has an
 * `autoGrade` field, so Payload's INSERT lists an `auto_grade` column, but no
 * migration ever added it and production does not run Drizzle "push". Postgres
 * then rejects the INSERT at parse time with `column "auto_grade" does not
 * exist`, which Drizzle masks behind its generic "Failed query" wrapper.
 *
 * We repair the schema here with a direct pg connection using the same (owner)
 * credentials the migrations use. Every statement is idempotent and the change
 * is global, so a single successful run permanently fixes production. A
 * module-level flag keeps this to one execution per warm server instance.
 */
let ensured = false

export async function ensureTasksSchema(): Promise<void> {
  if (ensured) return

  const connectionString =
    process.env.PAYLOAD_DATABASE_URL || process.env.DATABASE_URL
  if (!connectionString) {
    logger.error('ensureTasksSchema: no database URL in env')
    return
  }

  const pool = new Pool({ connectionString, max: 1 })
  try {
    // The actual bug: `auto_grade` column is missing from the table.
    await pool.query(
      `ALTER TABLE "payload"."tasks" ADD COLUMN IF NOT EXISTS "auto_grade" boolean DEFAULT false`,
    )
    // `correct_answer` is optional (open-ended tasks have none) but was NOT NULL.
    await pool.query(
      `ALTER TABLE "payload"."tasks" ALTER COLUMN "correct_answer" DROP NOT NULL`,
    )

    // Belt-and-suspenders: guarantee the primary keys can auto-generate an id,
    // in case an older bootstrap left them without a usable default.
    for (const table of ['tasks', 'tasks_choices']) {
      const { rows } = await pool.query(
        `SELECT data_type FROM information_schema.columns
          WHERE table_schema='payload' AND table_name=$1 AND column_name='id'`,
        [table],
      )
      const dt = (rows[0] as { data_type?: string } | undefined)?.data_type
      const expr =
        dt === 'uuid'
          ? 'gen_random_uuid()'
          : dt === 'character varying' || dt === 'text'
            ? 'gen_random_uuid()::varchar'
            : null
      if (expr) {
        await pool.query(
          `ALTER TABLE "payload"."${table}" ALTER COLUMN "id" SET DEFAULT ${expr}`,
        )
      }
    }

    ensured = true
    logger.info('ensureTasksSchema: tasks schema ensured', undefined, true)
  } catch (err) {
    logger.error('ensureTasksSchema failed', {
      message: err instanceof Error ? err.message : String(err),
    })
  } finally {
    await pool.end().catch(() => {})
  }
}
