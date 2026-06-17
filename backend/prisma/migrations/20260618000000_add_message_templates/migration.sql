-- CreateEnum (skip if already exists from prior db push)
DO $$ BEGIN
    CREATE TYPE "TemplateCategory" AS ENUM ('MARKETING', 'UTILITY', 'AUTHENTICATION');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "TemplateStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateTable (skip if already exists from prior db push)
CREATE TABLE IF NOT EXISTS "message_templates" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'id',
    "category" "TemplateCategory" NOT NULL,
    "status" "TemplateStatus" NOT NULL DEFAULT 'PENDING',
    "metaTemplateId" TEXT,
    "components" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "message_templates_companyId_idx" ON "message_templates"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "message_templates_companyId_name_language_key" ON "message_templates"("companyId", "name", "language");

-- AddForeignKey (skip if already exists)
DO $$ BEGIN
    ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_companyId_fkey"
        FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
