import { PrismaClient } from '@prisma/client';
import { topStatsExampleEmbed } from '../constants';

const prisma = new PrismaClient();

export const topStatsEmbed = async (guildId: string) => {
  const mostActiveMessageUsers = await prisma.$queryRaw<
    [{ memberId: string; count: number }]
  >`SELECT "memberId", count(*) FROM "MemberMessages" WHERE "guildId" = ${guildId} GROUP BY "memberId" ORDER BY count(*) DESC LIMIT 5`;

  const mostActiveMessageChannels = await prisma.$queryRaw<
    [{ channelId: string; count: number }]
  >`SELECT "channelId", count(*) FROM "MemberMessages" WHERE "guildId" = ${guildId} GROUP BY "channelId" ORDER BY count(*) DESC LIMIT 5`;

  return topStatsExampleEmbed({
    mostActiveMessageUsers,
    mostActiveMessageChannels,
  });
};
