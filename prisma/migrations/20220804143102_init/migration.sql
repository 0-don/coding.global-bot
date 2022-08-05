/*
  Warnings:

  - Changed the type of `type` on the `GuildVoiceEvents` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "VoiceType" AS ENUM ('JOIN', 'LEAVE');

-- CreateEnum
CREATE TYPE "Mutetype" AS ENUM ('MUTE', 'UNMUTE');

-- AlterTable
ALTER TABLE "GuildVoiceEvents" DROP COLUMN "type",
ADD COLUMN     "type" "VoiceType" NOT NULL;

-- DropEnum
DROP TYPE "Type";

-- CreateTable
CREATE TABLE "GuildMuteEvents" (
    "id" SERIAL NOT NULL,
    "memberId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "type" "Mutetype" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuildMuteEvents_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "GuildMuteEvents" ADD CONSTRAINT "GuildMuteEvents_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("memberId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildMuteEvents" ADD CONSTRAINT "GuildMuteEvents_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("guildId") ON DELETE RESTRICT ON UPDATE CASCADE;
