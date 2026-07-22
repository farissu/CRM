-- AlterTable (skip if already exists from prior db push)
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
