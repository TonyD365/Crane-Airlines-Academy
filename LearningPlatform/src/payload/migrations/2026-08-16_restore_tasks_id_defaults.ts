import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from 'drizzle-orm'

/**
 * Restore auto-generating PRIMARY KEY defaults on the tasks family of tables.
 *
 * Problem: creating a Practice Task failed in production with a masked
 * "Failed query: insert into payload.tasks ... values (default, ...)" error.
 * Payload/Drizzle relies on the DB to generate the primary key (`id` is
 * inserted as `default`), but:
 *   - `payload.tasks.id` lost its default during the 2026-02-09 varchar
 *     conversion (`ALTER COLUMN id TYPE varchar` without re-declaring a
 *     default), and
 *   - `payload.tasks_choices.id` was created as `varchar PRIMARY KEY NOT NULL`
 *     with no default at all (2026-02-09_add_subjects_and_blocks).
 * With no default, `VALUES (default)` writes NULL into a NOT NULL primary key,
 * which Postgres rejects. Drizzle only surfaces the generic "Failed query"
 * wrapper (the underlying cause lives on `error.cause`), so the createTask
 * error handler's `null value in column` check never matched.
 *
 * Fix: (re)declare `DEFAULT gen_random_uuid()::varchar` on both id columns.
 * Columns are varchar (not native uuid), so the cast keeps the stored value a
 * string, matching existing rows. `SET DEFAULT` is idempotent.
 */

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

export async function up({ db }: MigrateUpArgs): Promise<void> {
  console.log('[INFO] Restoring id defaults on tasks / tasks_choices...')
  await db.execute(setUuidDefaultIfVarchar('tasks'))
  await db.execute(setUuidDefaultIfVarchar('tasks_choices'))
  console.log('[SUCCESS] tasks / tasks_choices id defaults restored')
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "payload"."tasks" ALTER COLUMN "id" DROP DEFAULT;`)
  await db.execute(sql`ALTER TABLE "payload"."tasks_choices" ALTER COLUMN "id" DROP DEFAULT;`)
}
