import { prisma } from '../../prisma.js';
import { topStatsExampleEmbed } from '../constants.js';

export const topStatsEmbed = async (guildId: string) => {
  const limit = 10;

  const mostActiveMessageUsers = (await prisma.$queryRaw`
    SELECT "MemberMessages"."memberId", "Member"."username", count("MemberMessages"."memberId") 
    FROM "MemberMessages"
    LEFT JOIN "Member" ON "Member"."memberId" = "MemberMessages"."memberId" 
    WHERE "MemberMessages"."guildId" = ${guildId}
    GROUP BY "MemberMessages"."memberId", "Member"."username" 
    ORDER BY count(*) DESC 
    LIMIT ${limit}`) as [{ memberId: string; count: number; username: string }];

  const mostActiveMessageChannels = (await prisma.$queryRaw`
    SELECT "channelId", count(*) 
    FROM "MemberMessages" 
    WHERE "guildId" = ${guildId} 
    GROUP BY "channelId" 
    ORDER BY count(*) DESC 
    LIMIT ${limit}`) as [{ channelId: string; count: number }];

  const mostActiveVoiceUsers = (await prisma.$queryRaw`
    SELECT t."memberId", "Member"."username", SUM(difference) AS sum
    FROM (
        SELECT
        "memberId",
        EXTRACT(EPOCH FROM (COALESCE("leave", CURRENT_TIMESTAMP) - "join")) AS difference
        FROM "GuildVoiceEvents"
        WHERE "guildId" = ${guildId}) AS t
    JOIN "Member" ON "Member"."memberId" = t."memberId"
    GROUP BY t."memberId", "Member"."username"
    ORDER BY "sum" DESC
    LIMIT ${limit};`) as [{ memberId: string; username: string; sum: number }];

  const mostActiveVoiceChannels = (await prisma.$queryRaw`
    SELECT "channelId", SUM(difference) AS sum
    FROM (
        SELECT
        "channelId",
        EXTRACT(EPOCH FROM (COALESCE("leave", CURRENT_TIMESTAMP) - "join")) AS difference
        FROM "GuildVoiceEvents"
        WHERE "guildId" = ${guildId}) AS t
    GROUP BY "channelId"
    ORDER BY "sum" DESC
    LIMIT ${limit}`) as [{ channelId: string; sum: number }];

  return topStatsExampleEmbed({
    mostActiveMessageUsers,
    mostActiveMessageChannels,
    mostActiveVoiceUsers: mostActiveVoiceUsers.map((user) => ({
      ...user,
      sum: Number((user.sum / 60 / 60).toFixed(2)),
    })),
    mostActiveVoiceChannels: mostActiveVoiceChannels.map((channel) => ({
      ...channel,
      sum: Number((channel.sum / 60 / 60).toFixed(2)),
    })),
  });
};
