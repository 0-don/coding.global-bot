/*
  Warnings:

  - You are about to drop the column `helpCounter` on the `MemberGuild` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "MemberGuild" DROP COLUMN "helpCounter";

-- CreateTable
CREATE TABLE "MemberHelper" (
    "id" SERIAL NOT NULL,
    "memberId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "threadId" TEXT,
    "threadOwnerId" TEXT,

    CONSTRAINT "MemberHelper_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MemberHelper" ADD CONSTRAINT "MemberHelper_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("memberId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberHelper" ADD CONSTRAINT "MemberHelper_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("guildId") ON DELETE RESTRICT ON UPDATE CASCADE;
