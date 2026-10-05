-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('whatsapp', 'instagram');

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "channel" "Channel" NOT NULL DEFAULT 'whatsapp';

-- DropIndex
DROP INDEX "contacts_phoneNumber_key";

-- CreateIndex
CREATE UNIQUE INDEX "contacts_channel_phoneNumber_key" ON "contacts"("channel", "phoneNumber");
