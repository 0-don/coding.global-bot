-- DropForeignKey
ALTER TABLE "GuildVoiceEvents" DROP CONSTRAINT "GuildVoiceEvents_memberId_fkey";

-- AddForeignKey
ALTER TABLE "GuildVoiceEvents" ADD CONSTRAINT "GuildVoiceEvents_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("memberId") ON DELETE CASCADE ON UPDATE CASCADE;
