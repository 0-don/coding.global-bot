/*
  Warnings:

  - You are about to drop the `GuildMuteEvents` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "GuildMuteEvents" DROP CONSTRAINT "GuildMuteEvents_guildId_fkey";

-- DropForeignKey
ALTER TABLE "GuildMuteEvents" DROP CONSTRAINT "GuildMuteEvents_memberId_fkey";

-- DropTable
DROP TABLE "GuildMuteEvents";
