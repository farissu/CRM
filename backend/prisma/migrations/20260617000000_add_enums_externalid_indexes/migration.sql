-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('open', 'resolved', 'pending');
CREATE TYPE "MessageDirection" AS ENUM ('inbound', 'outbound');
CREATE TYPE "MessageType" AS ENUM ('text', 'image', 'video', 'document', 'audio', 'sticker');
CREATE TYPE "MessageStatus" AS ENUM ('sending', 'sent', 'delivered', 'read', 'failed', 'received');

-- AlterTable agents: add lastLoginAt
ALTER TABLE "agents" ADD COLUMN "lastLoginAt" TIMESTAMP(3);

-- AlterTable conversations: drop default, cast status, restore default
ALTER TABLE "conversations" ALTER COLUMN "status" DROP DEFAULT;
UPDATE "conversations" SET "status" = 'open' WHERE "status" NOT IN ('open', 'resolved', 'pending');
ALTER TABLE "conversations"
  ALTER COLUMN "status" TYPE "ConversationStatus" USING "status"::"ConversationStatus";
ALTER TABLE "conversations" ALTER COLUMN "status" SET DEFAULT 'open';

-- AlterTable messages: add externalId and updatedAt
ALTER TABLE "messages" ADD COLUMN "externalId" TEXT;
ALTER TABLE "messages" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Normalise any unknown values before casting
UPDATE "messages" SET "direction"   = 'inbound' WHERE "direction"   NOT IN ('inbound', 'outbound');
UPDATE "messages" SET "messageType" = 'text'    WHERE "messageType" NOT IN ('text', 'image', 'video', 'document', 'audio', 'sticker');
UPDATE "messages" SET "status"      = 'sent'    WHERE "status"      IS NOT NULL AND "status" NOT IN ('sending', 'sent', 'delivered', 'read', 'failed', 'received');

-- Drop defaults on messages before casting
ALTER TABLE "messages" ALTER COLUMN "messageType" DROP DEFAULT;
ALTER TABLE "messages" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "messages"
  ALTER COLUMN "direction"   TYPE "MessageDirection" USING "direction"::"MessageDirection",
  ALTER COLUMN "messageType" TYPE "MessageType"      USING "messageType"::"MessageType",
  ALTER COLUMN "status"      TYPE "MessageStatus"    USING "status"::"MessageStatus";

-- Restore defaults
ALTER TABLE "messages" ALTER COLUMN "messageType" SET DEFAULT 'text';
ALTER TABLE "messages" ALTER COLUMN "status" SET DEFAULT 'sent';

-- CreateIndex: ContactLabel reverse lookup
CREATE INDEX "contact_labels_labelId_idx" ON "contact_labels"("labelId");

-- CreateIndex: Conversation composite (status + lastMessageAt)
CREATE INDEX "conversations_status_lastMessageAt_idx" ON "conversations"("status", "lastMessageAt");

-- CreateUniqueIndex: Message externalId (partial — skip NULLs)
CREATE UNIQUE INDEX "messages_externalId_key" ON "messages"("externalId") WHERE "externalId" IS NOT NULL;
