-- DropEnum
DROP TYPE "ConversationStatus";

-- DropEnum
DROP TYPE "MessageDirection";

-- DropEnum
DROP TYPE "MessageStatus";

-- CreateTable
CREATE TABLE "labels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_labels" (
    "contactId" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_labels_pkey" PRIMARY KEY ("contactId","labelId")
);

-- CreateIndex
CREATE UNIQUE INDEX "labels_name_key" ON "labels"("name");

-- AddForeignKey
ALTER TABLE "contact_labels" ADD CONSTRAINT "contact_labels_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_labels" ADD CONSTRAINT "contact_labels_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
