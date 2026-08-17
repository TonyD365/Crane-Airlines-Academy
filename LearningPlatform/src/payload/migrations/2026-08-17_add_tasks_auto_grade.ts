import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from 'drizzle-orm'

/**
 * Add the missing `auto_grade` column to payload.tasks.
 *
 * The Tasks collection gained an `autoGrade` checkbox field, so Payload's
 * generated INSERT lists an `auto_grade` column — but no migration ever added
 * it to the table, and production never runs Drizzle "push". As a result every
 * task INSERT failed at parse time with `column "auto_grade" does not exist`,
 * surfaced only as Drizzle's generic "Failed query" wrapper.
 *
 * Also relax `correct_answer` to nullable: it is optional in the collection
 * (open-ended tasks have no correct answer), but the column was NOT NULL.
 *
 * And add the missing `tasks_tags.tag_id` column: the `tags` array field maps
 * `tagId` -> tag_id, but the table only had the legacy `tag` column, so
 * Payload's read-back SELECT failed with `column tasks_tags.tag_id does not
 * exist`.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE IF EXISTS "payload"."tasks"
      ADD COLUMN IF NOT EXISTS "auto_grade" boolean DEFAULT false;
  `)
  await db.execute(sql`
    ALTER TABLE IF EXISTS "payload"."tasks"
      ALTER COLUMN "correct_answer" DROP NOT NULL;
  `)
  await db.execute(sql`
    ALTER TABLE IF EXISTS "payload"."tasks_tags"
      ADD COLUMN IF NOT EXISTS "tag_id" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE IF EXISTS "payload"."tasks" DROP COLUMN IF EXISTS "auto_grade";
  `)
}
