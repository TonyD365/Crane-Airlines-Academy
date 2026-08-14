import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from 'drizzle-orm'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload"."subjects"
    ALTER COLUMN "id" TYPE VARCHAR
    USING "id"::VARCHAR;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload"."subjects"
    ALTER COLUMN "id" TYPE INTEGER
    USING "id"::INTEGER;
  `)
}
