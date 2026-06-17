-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "caption" TEXT,
ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "fileSize" INTEGER,
ADD COLUMN     "mediaType" TEXT,
ADD COLUMN     "mediaUrl" TEXT,
ALTER COLUMN "text" DROP NOT NULL;
