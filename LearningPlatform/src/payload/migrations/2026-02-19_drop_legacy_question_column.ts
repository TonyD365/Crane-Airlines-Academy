import { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from 'drizzle-orm'

/**
 * The initial schema created a `question jsonb NOT NULL` column on `payload.tasks`.
 * A later migration (2026-02-09_fix_schema_columns) added the Payload-managed `prompt`
 * column and copied the data across, but never dropped `question`.
 *
 * Every new insert from Payload writes `prompt` but omits `question`, which violates
 * the NOT NULL constraint and causes:
 *   "null value in column "question" of relation "tasks" violates not-null constraint"
 *
 * This migration removes the stale legacy column.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  console.log('[INFO] Running migration: drop legacy "question" column from tasks...')

  await db.execute(sql`
    -- Safety: copy any remaining rows that still have question but not prompt
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'payload'
          AND table_name = 'tasks'
          AND column_name = 'question'
      ) THEN

        EXECUTE '
          UPDATE "payload"."tasks"
          SET "prompt" = "question"
          WHERE "prompt" IS NULL
            AND "question" IS NOT NULL
        ';

      END IF;
    END
    $$;

    -- Drop the old column (wrapped in a conditional so re-running is safe)
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'payload'
          AND table_name   = 'tasks'
          AND column_name  = 'question'
      ) THEN
        ALTER TABLE "payload"."tasks" DROP COLUMN "question";
        RAISE NOTICE 'Dropped legacy "question" column from payload.tasks';
      ELSE
        RAISE NOTICE '"question" column already absent – nothing to do';
      END IF;
    END
    $$;
  `)

  console.log('[SUCCESS] Legacy "question" column removed from payload.tasks')
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  console.log('[INFO] Rolling back: re-adding "question" column (data not restored)...')

  await db.execute(sql`
    ALTER TABLE "payload"."tasks"
      ADD COLUMN IF NOT EXISTS "question" jsonb;
  `)

  // Copy prompt back into question for existing rows
  await db.execute(sql`
    UPDATE "payload"."tasks" SET "question" = "prompt" WHERE "question" IS NULL;
  `)

  console.log('[SUCCESS] Re-added "question" column (populated from "prompt").')
}
