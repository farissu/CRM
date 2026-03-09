/*
  Warnings:

  - The `role` column on the `agents` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `companyId` to the `agents` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'AGENT');

-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "avatar" TEXT,
ADD COLUMN     "companyId" TEXT NOT NULL,
ADD COLUMN     "phone" TEXT,
DROP COLUMN "role",
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'AGENT';

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "address" TEXT,
    "businessEntities" TEXT,
    "businessType" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "logo" TEXT,
    "webhookUrl" TEXT,
    "webhookCallbackUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agents_companyId_idx" ON "agents"("companyId");

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
