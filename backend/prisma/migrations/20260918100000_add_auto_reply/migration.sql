-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "lastAutoReplyAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "auto_reply_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "message" TEXT NOT NULL DEFAULT '',
    "workingDays" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[],
    "startTime" TEXT NOT NULL DEFAULT '09:00',
    "endTime" TEXT NOT NULL DEFAULT '17:00',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auto_reply_settings_pkey" PRIMARY KEY ("id")
);
