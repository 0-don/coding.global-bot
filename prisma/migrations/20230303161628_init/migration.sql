-- AlterTable
ALTER TABLE "MemberGuild" ADD COLUMN     "gptId" TEXT,
ADD COLUMN     "warnings" INTEGER NOT NULL DEFAULT 0;
