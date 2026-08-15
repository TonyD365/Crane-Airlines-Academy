-- Switch user identity to Roblox (RBX) OAuth: drop email + password login,
-- add the Roblox numeric user id used as the sign-in identity.
-- Dropping the columns automatically drops their dependent indexes.

ALTER TABLE "User" DROP COLUMN IF EXISTS "email";
ALTER TABLE "User" DROP COLUMN IF EXISTS "passwordHash";

ALTER TABLE "User" ADD COLUMN "rbxUserId" TEXT;

-- Unique per Roblox account (Postgres allows multiple NULLs, so existing rows
-- without a Roblox id do not clash until one is assigned).
CREATE UNIQUE INDEX "User_rbxUserId_key" ON "User"("rbxUserId");
CREATE INDEX "User_rbxUserId_idx" ON "User"("rbxUserId");
