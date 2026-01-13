-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "expiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Attachment_expiresAt_idx" ON "Attachment"("expiresAt");
