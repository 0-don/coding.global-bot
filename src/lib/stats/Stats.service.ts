import dayjs from "dayjs";
import { CacheType, CommandInteraction, GuildMember, User } from "discord.js";
import { prisma } from "../../prisma.js";
import { ChartDataset } from "../../types/index.js";
import { topStatsExampleEmbed, userStatsExampleEmbed } from "../embeds.js";
import { getDaysArray } from "../helpers.js";

export class StatsService {
  static async topStatsEmbed(guildId: string) {
    const limit = 10;

    const mostActiveMessageUsers = (await prisma.$queryRaw`
      SELECT "MemberMessages"."memberId", "Member"."username", count("MemberMessages"."memberId") 
      FROM "MemberMessages"
      LEFT JOIN "Member" ON "Member"."memberId" = "MemberMessages"."memberId" 
      WHERE "MemberMessages"."guildId" = ${guildId}
      GROUP BY "MemberMessages"."memberId", "Member"."username" 
      ORDER BY count(*) DESC 
      LIMIT ${limit}`) as [{ memberId: string; count: number; username: string }];

    const mostHelpfulUsers = (await prisma.$queryRaw`
      SELECT "MemberHelper"."memberId", "Member"."username", count(*)
      FROM "MemberHelper"
      LEFT JOIN "Member" ON "Member"."memberId" = "MemberHelper"."memberId" 
      WHERE "MemberHelper"."guildId" = ${guildId}
      GROUP BY "MemberHelper"."memberId", "Member"."username"
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
      mostHelpfulUsers,
      mostActiveVoiceUsers: mostActiveVoiceUsers.map((user) => ({
        ...user,
        sum: Number((user.sum / 60 / 60).toFixed(2)),
      })),
      mostActiveVoiceChannels: mostActiveVoiceChannels.map((channel) => ({
        ...channel,
        sum: Number((channel.sum / 60 / 60).toFixed(2)),
      })),
    });
  }

  static async userStatsEmbed(interaction: CommandInteraction<CacheType>, user?: User | null) {
    const memberId = user?.id ?? interaction.member?.user.id;
    const guildId = interaction.guild?.id;

    const memberGuild = await prisma.memberGuild.findFirst({
      where: { guildId, memberId },
      include: { member: true },
    });

    const lastVoice = await prisma.guildVoiceEvents.findMany({
      where: { guildId, memberId },
      orderBy: { id: "desc" },
      take: 1,
    });

    const lastMessage = await prisma.memberMessages.findMany({
      where: { guildId, memberId },
      orderBy: { id: "desc" },
      take: 1,
    });

    const helpCount = await prisma.memberHelper.count({
      where: { guildId, memberId },
    });

    const helpReceivedCount = await prisma.memberHelper.count({
      where: { guildId, threadOwnerId: memberId },
    });

    const userServerName = user?.toString() ?? interaction.member?.user.toString();

    if (!memberId || !guildId || !memberGuild || !userServerName) return "Something went wrong";

    const member = user?.id ? await interaction.guild?.members.fetch(user.id) : (interaction.member as GuildMember);

    const {
      lookbackDaysCount,
      oneDayCount,
      sevenDaysCount,
      mostActiveTextChannelId,
      mostActiveTextChannelMessageCount,
    } = await StatsService.messagesStats(memberId, guildId, memberGuild.lookback);

    const { mostActiveVoice, lookbackVoiceSum, sevenDayVoiceSum, oneDayVoiceSum } = await StatsService.voiceStats(
      memberId,
      guildId,
      memberGuild.lookback,
    );

    const embed = userStatsExampleEmbed({
      id: memberId,
      helpCount,
      helpReceivedCount,
      userGlobalName: memberGuild.member.username,
      userServerName,
      lookback: memberGuild.lookback,
      createdAt: member.user.createdAt,
      joinedAt: member.joinedAt,
      lookbackDaysCount,
      oneDayCount,
      sevenDaysCount,
      mostActiveTextChannelId,
      mostActiveTextChannelMessageCount,
      lastVoice,
      lastMessage,
      mostActiveVoice,
      lookbackVoiceSum,
      sevenDayVoiceSum,
      oneDayVoiceSum,
    });

    return embed;
  }

  static async voiceStats(memberId: string, guildId: string, lookback: number) {
    const voiceStatsLookback = (await prisma.$queryRaw`
      SELECT "channelId", SUM(difference) AS sum
      FROM (
          SELECT
          "channelId",
          EXTRACT(EPOCH FROM (COALESCE("leave", CURRENT_TIMESTAMP) - "join")) AS difference
          FROM "GuildVoiceEvents"
          WHERE "memberId" = ${memberId} 
            AND "guildId" = ${guildId}
            AND "join" > (NOW() - ${lookback + " day"}::interval)
          ) AS t
      GROUP BY "channelId"
      ORDER BY "sum" DESC;`) as [{ channelId: string; sum: number }];

    const voiceStatsSevenDays = (await prisma.$queryRaw`
      SELECT "channelId", SUM(difference) AS sum
      FROM (
          SELECT
          "channelId",
          EXTRACT(EPOCH FROM (COALESCE("leave", CURRENT_TIMESTAMP) - "join")) AS difference
          FROM "GuildVoiceEvents"
          WHERE "memberId" = ${memberId} 
            AND "guildId" = ${guildId}
            AND "join" > (NOW() - '7 days'::interval)
          ) AS t
      GROUP BY "channelId"
      ORDER BY "sum" DESC;`) as [{ channelId: string; sum: number }];

    const voiceStatsOneDay = (await prisma.$queryRaw`
      SELECT "channelId", SUM(difference) AS sum
      FROM (
          SELECT
          "channelId",
          EXTRACT(EPOCH FROM (COALESCE("leave", CURRENT_TIMESTAMP) - "join")) AS difference
          FROM "GuildVoiceEvents"
          WHERE "memberId" = ${memberId} 
            AND "guildId" = ${guildId}
            AND "join" > (NOW() - '1 day'::interval)
          ) AS t
      GROUP BY "channelId"
      ORDER BY "sum" DESC;`) as [{ channelId: string; sum: number }];

    const mostActiveVoice = {
      ...voiceStatsLookback?.[0],
      sum: Number((Number(voiceStatsLookback?.[0]?.sum) / 60 / 60).toFixed(2)),
    };
    const lookbackVoiceSum = Number(
      (voiceStatsLookback.reduce((acc, curr) => acc + Number(curr.sum), 0) / 60 / 60).toFixed(2),
    );

    const sevenDayVoiceSum = Number(
      (
        voiceStatsSevenDays.reduce((acc, curr) => Number(acc) + Number(Number(curr.sum).toFixed(0)), 0) /
        60 /
        60
      ).toFixed(2),
    );
    const oneDayVoiceSum = Number(
      (voiceStatsOneDay.reduce((acc, curr) => Number(acc) + Number(Number(curr.sum).toFixed(0)), 0) / 60 / 60).toFixed(
        2,
      ),
    );

    return {
      mostActiveVoice,
      lookbackVoiceSum,
      sevenDayVoiceSum,
      oneDayVoiceSum,
    };
  }

  static async messagesStats(memberId: string, guildId: string, lookback: number) {
    const memberMessagesByDate = (await prisma.memberMessages.findMany({
      where: { memberId, guildId },
      orderBy: { createdAt: "asc" },
    })) ?? [{ createdAt: new Date() }];

    const mostActiveTextChannel = (await prisma.$queryRaw`
      SELECT "channelId", count(*) 
      FROM "MemberMessages" 
      WHERE "memberId" = ${memberId} 
      GROUP BY "channelId" 
      ORDER BY count(*) DESC 
      LIMIT 1`) as { channelId: string; count: number }[];

    const mostActiveTextChannelId = mostActiveTextChannel?.[0]?.channelId;
    const mostActiveTextChannelMessageCount = Number(mostActiveTextChannel?.[0]?.count ?? 0);

    // create date array from first to today for each day
    const startEndDateArray = getDaysArray(memberMessagesByDate[0]?.createdAt!, dayjs().add(1, "day").toDate());

    const messages: ChartDataset[] = startEndDateArray.map((date) => ({
      x: dayjs(date).toDate(),
      y: memberMessagesByDate.filter(({ createdAt }) => dayjs(createdAt) <= dayjs(date)).length,
    }));

    let lookbackDaysCount = messages[messages.length - 1]?.y ?? 0;
    let sevenDaysCount = messages[messages.length - 1]?.y ?? 0;
    let oneDayCount = messages[messages.length - 1]?.y ?? 0;

    // count total members for date ranges
    if (messages.length > lookback)
      lookbackDaysCount = messages[messages.length - 1]!.y - messages[messages.length - lookback]!.y;
    if (messages.length > 8) sevenDaysCount = messages[messages.length - 1]!.y - messages[messages.length - 7]!.y;
    if (messages.length > 3) oneDayCount = messages[messages.length - 1]!.y - messages[messages.length - 2]!.y;

    return {
      mostActiveTextChannelId,
      mostActiveTextChannelMessageCount,
      lookbackDaysCount,
      oneDayCount,
      sevenDaysCount,
    };
  }
}
