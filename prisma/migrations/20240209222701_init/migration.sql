/*
  Warnings:

  - You are about to drop the `MemberBump` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "MemberBump" DROP CONSTRAINT "MemberBump_guildId_fkey";

-- DropForeignKey
ALTER TABLE "MemberBump" DROP CONSTRAINT "MemberBump_memberId_fkey";

-- DropTable
DROP TABLE "MemberBump";

-- CreateTable
CREATE TABLE "MemberCommandHistory" (
    "id" SERIAL NOT NULL,
    "memberId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberCommandHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberDeletedMessages" (
    "id" SERIAL NOT NULL,
    "memberId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberDeletedMessages_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MemberCommandHistory" ADD CONSTRAINT "MemberCommandHistory_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("memberId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberCommandHistory" ADD CONSTRAINT "MemberCommandHistory_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("guildId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberDeletedMessages" ADD CONSTRAINT "MemberDeletedMessages_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("memberId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberDeletedMessages" ADD CONSTRAINT "MemberDeletedMessages_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("guildId") ON DELETE RESTRICT ON UPDATE CASCADE;
