-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "failedRefreshAttempts" INTEGER NOT NULL DEFAULT 0;
