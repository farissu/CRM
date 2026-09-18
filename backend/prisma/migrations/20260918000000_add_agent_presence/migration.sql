-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('active', 'offline');

-- CreateEnum
CREATE TYPE "StatusChangeSource" AS ENUM ('auto', 'manual');

-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "status" "AgentStatus" NOT NULL DEFAULT 'offline',
ADD COLUMN     "statusUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "agent_status_logs" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "status" "AgentStatus" NOT NULL,
    "source" "StatusChangeSource" NOT NULL DEFAULT 'auto',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_status_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_status_logs_agentId_startedAt_idx" ON "agent_status_logs"("agentId", "startedAt");

-- AddForeignKey
ALTER TABLE "agent_status_logs" ADD CONSTRAINT "agent_status_logs_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
