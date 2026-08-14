import { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from 'drizzle-orm'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  console.log('[INFO] Running migration: fix schema column names and nullability...')
  try {
    await db.execute(sql`
    -- Allow old 'subject' column to be nullable so new inserts using subject_id succeed
    -- Only alter if the column exists to avoid failures on databases without the column
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema='payload' AND table_name='courses' AND column_name='subject'
      ) THEN
        EXECUTE 'ALTER TABLE "payload"."courses" ALTER COLUMN "subject" DROP NOT NULL';
      END IF;
    END
    $$;

    -- Add subject_id if missing (already added by previous migration, safe to run again)
    ALTER TABLE IF EXISTS "payload"."courses" ADD COLUMN IF NOT EXISTS "subject_id" varchar;

    -- Ensure lessons have the columns payload expects: 'course_id' and 'order'
    ALTER TABLE IF EXISTS "payload"."lessons" ADD COLUMN IF NOT EXISTS "course_id" varchar;
    ALTER TABLE IF EXISTS "payload"."lessons" ADD COLUMN IF NOT EXISTS "order" integer;

    -- Ensure modules have an 'order' column matching expected name
    ALTER TABLE IF EXISTS "payload"."modules" ADD COLUMN IF NOT EXISTS "order" integer;

    -- Populate simple mappings where possible
    DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'payload'
            AND table_name = 'modules'
            AND column_name = 'order_index'
        ) THEN
          EXECUTE '
            UPDATE "payload"."modules"
            SET "order" = COALESCE("order", "order_index")
          ';
        END IF;

        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'payload'
            AND table_name = 'lessons'
            AND column_name = 'order_index'
        ) THEN
          EXECUTE '
            UPDATE "payload"."lessons"
            SET "order" = COALESCE("order", "order_index")
          ';
        END IF;
      END
    $$;
    
    -- Ensure legacy order_index doesn't block inserts: set defaults and allow NULL
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='payload' AND table_name='modules' AND column_name='order_index') THEN
        EXECUTE 'ALTER TABLE "payload"."modules" ALTER COLUMN "order_index" SET DEFAULT 0';
        EXECUTE 'UPDATE "payload"."modules" SET "order_index" = COALESCE("order_index", "order")';
        EXECUTE 'ALTER TABLE "payload"."modules" ALTER COLUMN "order_index" DROP NOT NULL';
      END IF;

      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='payload' AND table_name='lessons' AND column_name='order_index') THEN
        EXECUTE 'ALTER TABLE "payload"."lessons" ALTER COLUMN "order_index" SET DEFAULT 0';
        EXECUTE 'UPDATE "payload"."lessons" SET "order_index" = COALESCE("order_index", "order")';
        EXECUTE 'ALTER TABLE "payload"."lessons" ALTER COLUMN "order_index" DROP NOT NULL';
      END IF;
    END
    $$;
    
    -- Ensure tasks table has columns expected by runtime
    ALTER TABLE IF EXISTS "payload"."tasks" ADD COLUMN IF NOT EXISTS "type" varchar;
    ALTER TABLE IF EXISTS "payload"."tasks" ADD COLUMN IF NOT EXISTS "prompt" jsonb;
    ALTER TABLE IF EXISTS "payload"."tasks" ADD COLUMN IF NOT EXISTS "question_media_id" varchar;
    ALTER TABLE IF EXISTS "payload"."tasks" ADD COLUMN IF NOT EXISTS "solution" jsonb;
    ALTER TABLE IF EXISTS "payload"."tasks" ADD COLUMN IF NOT EXISTS "solution_media_id" varchar;
    ALTER TABLE IF EXISTS "payload"."tasks" ADD COLUMN IF NOT EXISTS "solution_video_url" varchar;
    ALTER TABLE IF EXISTS "payload"."tasks" ADD COLUMN IF NOT EXISTS "points" integer DEFAULT 1;
    ALTER TABLE IF EXISTS "payload"."tasks" ADD COLUMN IF NOT EXISTS "order" integer DEFAULT 0;
    ALTER TABLE IF EXISTS "payload"."tasks" ADD COLUMN IF NOT EXISTS "is_published" boolean DEFAULT false;

    
    -- Ensure points default
    UPDATE "payload"."tasks" SET "points" = COALESCE("points", 1);
    `)

    console.log('[SUCCESS] Schema column fixes applied')
  } catch (err) {
    console.error('[ERROR] Migration failed:', err)
    throw err
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  void db
  throw new Error('Cannot rollback schema fix migration')
}
