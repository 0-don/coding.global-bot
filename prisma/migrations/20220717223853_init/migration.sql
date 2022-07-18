-- CreateEnum
CREATE TYPE "Type" AS ENUM ('JOIN', 'LEAVE', 'MUTE', 'UNMUTE');

-- AlterTable
ALTER TABLE "MemberGuild" ADD COLUMN     "lookback" INTEGER NOT NULL DEFAULT 9999;

-- CreateTable
CREATE TABLE "GuildVoiceEvents" (
    "id" SERIAL NOT NULL,
    "memberId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "type" "Type" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuildVoiceEvents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberMessages" (
    "id" SERIAL NOT NULL,
    "memberId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,

    CONSTRAINT "MemberMessages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuildVoiceEvents_memberId_guildId_key" ON "GuildVoiceEvents"("memberId", "guildId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberMessages_memberId_guildId_key" ON "MemberMessages"("memberId", "guildId");

-- AddForeignKey
ALTER TABLE "GuildVoiceEvents" ADD CONSTRAINT "GuildVoiceEvents_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("guildId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildVoiceEvents" ADD CONSTRAINT "GuildVoiceEvents_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("memberId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberMessages" ADD CONSTRAINT "MemberMessages_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("guildId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberMessages" ADD CONSTRAINT "MemberMessages_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("memberId") ON DELETE CASCADE ON UPDATE CASCADE;
