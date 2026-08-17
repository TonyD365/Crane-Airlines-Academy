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
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE IF EXISTS "payload"."tasks" DROP COLUMN IF EXISTS "auto_grade";
  `)
}
