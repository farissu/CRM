-- AlterTable
ALTER TABLE "conversations" ADD COLUMN "lastMessageDirection" "MessageDirection";

-- CreateIndex
CREATE INDEX "conversations_status_lastMessageDirection_idx" ON "conversations"("status", "lastMessageDirection");

-- Backfill: existing conversations would otherwise sit at NULL until their next message,
-- so the "Belum Dibalas" tab would miss every already-awaiting-reply conversation until
-- then. One-time derive from each conversation's most recent message.
UPDATE "conversations" c
SET "lastMessageDirection" = m."direction"
FROM (
  SELECT DISTINCT ON ("conversationId") "conversationId", "direction"
  FROM "messages"
  ORDER BY "conversationId", "timestamp" DESC
) m
WHERE c.id = m."conversationId";
