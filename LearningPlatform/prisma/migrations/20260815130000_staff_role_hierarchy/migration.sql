-- Replace the binary Role enum (STUDENT, ADMIN) with a staff hierarchy.
-- Existing ADMIN accounts become PRESIDENT (the top tier). Recreating the type
-- keeps the DB enum exactly in sync with the Prisma schema and cleanly removes
-- the old ADMIN value in a single transaction.

ALTER TYPE "Role" RENAME TO "Role_old";

CREATE TYPE "Role" AS ENUM ('STUDENT', 'TRAINER', 'MANAGER', 'PRESIDENT');

ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "Role"
  USING (
    CASE
      WHEN "role"::text = 'ADMIN' THEN 'PRESIDENT'
      ELSE "role"::text
    END
  )::"Role";

ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'STUDENT';

DROP TYPE "Role_old";
