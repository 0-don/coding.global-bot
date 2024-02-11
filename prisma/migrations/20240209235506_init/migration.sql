/*
  Warnings:

  - You are about to drop the column `memberId` on the `MemberDeletedMessages` table. All the data in the column will be lost.
  - Added the required column `deletedByMemberId` to the `MemberDeletedMessages` table without a default value. This is not possible if the table is not empty.
  - Added the required column `messageMemberId` to the `MemberDeletedMessages` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "MemberDeletedMessages" DROP CONSTRAINT "MemberDeletedMessages_memberId_fkey";

-- AlterTable
ALTER TABLE "MemberDeletedMessages" DROP COLUMN "memberId",
ADD COLUMN     "deletedByMemberId" TEXT NOT NULL,
ADD COLUMN     "messageMemberId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "MemberDeletedMessages" ADD CONSTRAINT "MemberDeletedMessages_deletedByMemberId_fkey" FOREIGN KEY ("deletedByMemberId") REFERENCES "Member"("memberId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberDeletedMessages" ADD CONSTRAINT "MemberDeletedMessages_messageMemberId_fkey" FOREIGN KEY ("messageMemberId") REFERENCES "Member"("memberId") ON DELETE CASCADE ON UPDATE CASCADE;
