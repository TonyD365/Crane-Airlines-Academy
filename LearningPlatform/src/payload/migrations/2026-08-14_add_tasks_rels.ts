import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from 'drizzle-orm'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "payload"."tasks_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" varchar NOT NULL,
      "path" varchar NOT NULL,
      "lessons_id" varchar
    );

    CREATE INDEX IF NOT EXISTS "tasks_rels_parent_idx"
      ON "payload"."tasks_rels" ("parent_id");

    CREATE INDEX IF NOT EXISTS "tasks_rels_lessons_idx"
      ON "payload"."tasks_rels" ("lessons_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "payload"."tasks_rels";
  `)
}
