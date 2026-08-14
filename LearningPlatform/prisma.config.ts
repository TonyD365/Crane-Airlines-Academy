// Prisma configuration
// - Loads `.env` automatically when present (local development).
// - In Docker / production provide `DATABASE_URL` or `PAYLOAD_DATABASE_URL` via environment.
// - Emits a non-fatal console warning when no database URL is available.
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { defineConfig } from "prisma/config";

// Load .env for local development if present. Using createRequire makes this
// work in both CommonJS and ESM contexts (Prisma may load this file either way).
try {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const require = createRequire(import.meta.url);
     
    require("dotenv").config({ path: envPath });
  }
} catch {
  // Non-fatal: continue and rely on process.env
}

const migrationDatabaseUrl = process.env["MIGRATION_DATABASE_URL"];
const databaseUrl = process.env["DATABASE_URL"];
const payloadDatabaseUrl = process.env["PAYLOAD_DATABASE_URL"];

const rawUrl =
  migrationDatabaseUrl ??
  databaseUrl ??
  payloadDatabaseUrl ??
  undefined;

/**
 * Sanitize a Postgres connection URL that may be malformed.
 * Railway (and other platforms) sometimes provide DATABASE_URL without the '?'
 * separator before query parameters (e.g. "...railway&schema=public&sslmode=require"
 * instead of "...railway?schema=public&sslmode=require"). Prisma interprets the whole
 * thing as the database name which causes it to use the wrong schema.
 */
function sanitizeDbUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  // If there is no '?' but there IS an '&', the first '&' should be a '?'
  if (!url.includes('?') && url.includes('&')) {
    const fixed = url.replace('&', '?');
     
    console.warn('[prisma.config] DATABASE_URL was missing "?" before query params — auto-corrected.');
    return fixed;
  }
  return url;
}

const dbUrl = sanitizeDbUrl(rawUrl);

if (!dbUrl) {
   
  console.warn(
    "Warning: neither DATABASE_URL nor PAYLOAD_DATABASE_URL is set. Provide one for Prisma to connect to the database."
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: dbUrl,
  },
});
