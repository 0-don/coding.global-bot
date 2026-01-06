import dayjs from "dayjs";
import { CacheType, CommandInteraction, User } from "discord.js";
import { bot } from "../../main";
import { prisma } from "../../prisma";
import { ChartDataset } from "../../types/index";
import { topStatsExampleEmbed, userStatsExampleEmbed } from "../embeds";
import { getDaysArray } from "../helpers";

export class StatsService {
  // Returns raw data for API usage
  static async getTopStats(guildId: string, lastDaysCount: number = 9999, limit: number = 10) {
    // Execute all queries in parallel
    const [
      mostActiveMessageUsers,
      mostHelpfulUsers,
      mostActiveMessageChannels,
      mostActiveVoiceUsers,
      mostActiveVoiceChannels,
      totalMessagesResult,
      totalVoiceHoursResult,
    ] = await Promise.all([
      prisma.$queryRaw`
        SELECT "MemberMessages"."memberId", "Member"."username", count("MemberMessages"."memberId")
        FROM "MemberMessages"
        LEFT JOIN "Member" ON "Member"."memberId" = "MemberMessages"."memberId"
        WHERE "MemberMessages"."guildId" = ${guildId}
        AND "MemberMessages"."createdAt" > (NOW() - ${`${lastDaysCount} days`}::interval)
        GROUP BY "MemberMessages"."memberId", "Member"."username"
        ORDER BY count(*) DESC
        LIMIT ${limit}` as Promise<
        { memberId: string; count: bigint; username: string }[]
      >,

      prisma.$queryRaw`
        SELECT "MemberHelper"."memberId", "Member"."username", count(*)
        FROM "MemberHelper"
        LEFT JOIN "Member" ON "Member"."memberId" = "MemberHelper"."memberId"
        WHERE "MemberHelper"."guildId" = ${guildId}
        AND "MemberHelper"."createdAt" > (NOW() - ${`${lastDaysCount} days`}::interval)
        GROUP BY "MemberHelper"."memberId", "Member"."username"
        ORDER BY count(*) DESC
        LIMIT ${limit}` as Promise<
        { memberId: string; count: bigint; username: string }[]
      >,

      prisma.$queryRaw`
        SELECT "channelId", count(*)
        FROM "MemberMessages"
        WHERE "guildId" = ${guildId}
        AND "createdAt" > (NOW() - ${`${lastDaysCount} days`}::interval)
        GROUP BY "channelId"
        ORDER BY count(*) DESC
        LIMIT ${limit}` as Promise<{ channelId: string; count: bigint }[]>,

      prisma.$queryRaw`
        SELECT t."memberId", "Member"."username", SUM(difference) AS sum
        FROM (
            SELECT
            "memberId",
            EXTRACT(EPOCH FROM (COALESCE("leave", CURRENT_TIMESTAMP) - "join")) AS difference
            FROM "GuildVoiceEvents"
            WHERE "guildId" = ${guildId}
            AND "join" > (NOW() - ${`${lastDaysCount} days`}::interval)) AS t
        JOIN "Member" ON "Member"."memberId" = t."memberId"
        GROUP BY t."memberId", "Member"."username"
        ORDER BY "sum" DESC
        LIMIT ${limit}` as Promise<
        { memberId: string; username: string; sum: number }[]
      >,

      prisma.$queryRaw`
        SELECT "channelId", SUM(difference) AS sum
        FROM (
            SELECT
            "channelId",
            EXTRACT(EPOCH FROM (COALESCE("leave", CURRENT_TIMESTAMP) - "join")) AS difference
            FROM "GuildVoiceEvents"
            WHERE "guildId" = ${guildId}
            AND "join" > (NOW() - ${`${lastDaysCount} days`}::interval)) AS t
        GROUP BY "channelId"
        ORDER BY "sum" DESC
        LIMIT ${limit}` as Promise<{ channelId: string; sum: number }[]>,

      // Total messages count (all, not limited)
      prisma.$queryRaw`
        SELECT count(*) as total
        FROM "MemberMessages"
        WHERE "guildId" = ${guildId}
        AND "createdAt" > (NOW() - ${`${lastDaysCount} days`}::interval)` as Promise<
        [{ total: bigint }]
      >,

      // Total voice hours (all, not limited)
      prisma.$queryRaw`
        SELECT COALESCE(SUM(difference), 0) AS total
        FROM (
            SELECT
            EXTRACT(EPOCH FROM (COALESCE("leave", CURRENT_TIMESTAMP) - "join")) AS difference
            FROM "GuildVoiceEvents"
            WHERE "guildId" = ${guildId}
            AND "join" > (NOW() - ${`${lastDaysCount} days`}::interval)) AS t` as Promise<
        [{ total: number }]
      >,
    ]);

    return {
      mostActiveMessageUsers: mostActiveMessageUsers.map((user) => ({
        ...user,
        count: Number(user.count),
      })),
      mostHelpfulUsers: mostHelpfulUsers.map((user) => ({
        ...user,
        count: Number(user.count),
      })),
      mostActiveMessageChannels: mostActiveMessageChannels.map((channel) => ({
        ...channel,
        count: Number(channel.count),
      })),
      mostActiveVoiceUsers: mostActiveVoiceUsers.map((user) => ({
        ...user,
        sum: Number((user.sum / 60 / 60).toFixed(2)),
      })),
      mostActiveVoiceChannels: mostActiveVoiceChannels.map((channel) => ({
        ...channel,
        sum: Number((channel.sum / 60 / 60).toFixed(2)),
      })),
      totalMessages: Number(totalMessagesResult[0]?.total ?? 0),
      totalVoiceHours: Number(
        ((totalVoiceHoursResult[0]?.total ?? 0) / 60 / 60).toFixed(0),
      ),
      lookback: lastDaysCount,
    };
  }

  // Returns embed for Discord bot usage
  static async topStatsEmbed(guildId: string, lastDaysCount: number = 9999) {
    const data = await this.getTopStats(guildId, lastDaysCount);
    return topStatsExampleEmbed(data);
  }

  static async userStatsEmbed(
    interaction: CommandInteraction<CacheType>,
    user?: User | null,
  ) {
    const memberId = user?.id ?? interaction.member?.user.id;
    const guildId = interaction.guild?.id;

    if (!memberId || !guildId) return null;

    const embed = await StatsService.getUserStatsEmbed(memberId, guildId);

    if (!embed) return null;

    return embed;
  }

  static async getUserStatsEmbed(memberId: string, guildId: string) {
    const memberGuild = await prisma.memberGuild.findFirst({
      where: { guildId, memberId },
      include: { member: true },
    });

    if (!memberGuild) return null;

    // Fetch Discord user and guild member data
    const [user, guild] = await Promise.all([
      bot.users.fetch(memberId).catch(() => null),
      bot.guilds.fetch(guildId).catch(() => null),
    ]);

    const member = guild
      ? await guild.members.fetch(memberId).catch(() => null)
      : null;

    // Execute all initial queries in parallel
    const [lastVoice, lastMessage, helpCount, helpReceivedCount, userRoles] =
      await Promise.all([
        prisma.guildVoiceEvents.findMany({
          where: { guildId, memberId },
          orderBy: { id: "desc" },
          take: 1,
        }),
        prisma.memberMessages.findMany({
          where: { guildId, memberId },
          orderBy: { id: "desc" },
          take: 1,
        }),
        prisma.memberHelper.count({
          where: { guildId, memberId },
        }),
        prisma.memberHelper.count({
          where: { guildId, threadOwnerId: memberId },
        }),
        prisma.memberRole.findMany({
          where: { memberId, guildId },
          select: { name: true, roleId: true },
        }),
      ]);

    // Execute stats queries in parallel
    const [messagesStats, voiceStats] = await Promise.all([
      StatsService.messagesStats(memberId, guildId, memberGuild.lookback),
      StatsService.voiceStats(memberId, guildId, memberGuild.lookback),
    ]);

    const {
      lookbackDaysCount,
      oneDayCount,
      sevenDaysCount,
      mostActiveTextChannelId,
      mostActiveTextChannelMessageCount,
    } = messagesStats;

    const {
      mostActiveVoice,
      lookbackVoiceSum,
      sevenDayVoiceSum,
      oneDayVoiceSum,
    } = voiceStats;

    const embed = userStatsExampleEmbed({
      id: memberId,
      helpCount,
      helpReceivedCount,
      userGlobalName: memberGuild.member.username,
      userServerName:
        member?.toString() ?? user?.toString() ?? memberGuild.member.username,
      lookback: memberGuild.lookback,
      createdAt: user!.createdAt,
      joinedAt: member!.joinedAt,
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

    return { embed, roles: userRoles.map((role) => role.name) };
  }

  static async voiceStats(memberId: string, guildId: string, lookback: number) {
    // Execute all voice stat queries in parallel
    const [voiceStatsLookback, voiceStatsSevenDays, voiceStatsOneDay] =
      await Promise.all([
        prisma.$queryRaw`
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
          ORDER BY "sum" DESC` as Promise<[{ channelId: string; sum: number }]>,

        prisma.$queryRaw`
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
          ORDER BY "sum" DESC` as Promise<[{ channelId: string; sum: number }]>,

        prisma.$queryRaw`
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
          ORDER BY "sum" DESC` as Promise<[{ channelId: string; sum: number }]>,
      ]);

    const mostActiveVoice = {
      ...voiceStatsLookback?.[0],
      sum: Number((Number(voiceStatsLookback?.[0]?.sum) / 60 / 60).toFixed(2)),
    };
    const lookbackVoiceSum = Number(
      (
        voiceStatsLookback.reduce((acc, curr) => acc + Number(curr.sum), 0) /
        60 /
        60
      ).toFixed(2),
    );

    const sevenDayVoiceSum = Number(
      (
        voiceStatsSevenDays.reduce(
          (acc, curr) => Number(acc) + Number(Number(curr.sum).toFixed(0)),
          0,
        ) /
        60 /
        60
      ).toFixed(2),
    );
    const oneDayVoiceSum = Number(
      (
        voiceStatsOneDay.reduce(
          (acc, curr) => Number(acc) + Number(Number(curr.sum).toFixed(0)),
          0,
        ) /
        60 /
        60
      ).toFixed(2),
    );

    return {
      mostActiveVoice,
      lookbackVoiceSum,
      sevenDayVoiceSum,
      oneDayVoiceSum,
    };
  }

  static async messagesStats(
    memberId: string,
    guildId: string,
    lookback: number,
  ) {
    // Execute message stat queries in parallel
    const [memberMessagesByDate, mostActiveTextChannel] = await Promise.all([
      prisma.memberMessages.findMany({
        where: { memberId, guildId },
        orderBy: { createdAt: "asc" },
      }),
      prisma.$queryRaw`
        SELECT "channelId", count(*) 
        FROM "MemberMessages" 
        WHERE "memberId" = ${memberId} 
        GROUP BY "channelId" 
        ORDER BY count(*) DESC 
        LIMIT 1` as Promise<{ channelId: string; count: number }[]>,
    ]);

    const mostActiveTextChannelId = mostActiveTextChannel?.[0]?.channelId;
    const mostActiveTextChannelMessageCount = Number(
      mostActiveTextChannel?.[0]?.count ?? 0,
    );

    // create date array from first to today for each day
    const startEndDateArray = getDaysArray(
      memberMessagesByDate[0]?.createdAt ?? new Date(),
      dayjs().add(1, "day").toDate(),
    );

    const messages: ChartDataset[] = startEndDateArray.map((date) => ({
      x: dayjs(date).toDate(),
      y: memberMessagesByDate.filter(
        ({ createdAt }) => dayjs(createdAt) <= dayjs(date),
      ).length,
    }));

    let lookbackDaysCount = messages[messages.length - 1]?.y ?? 0;
    let sevenDaysCount = messages[messages.length - 1]?.y ?? 0;
    let oneDayCount = messages[messages.length - 1]?.y ?? 0;

    // count total members for date ranges
    if (messages.length > lookback)
      lookbackDaysCount =
        messages[messages.length - 1]!.y -
        messages[messages.length - lookback]!.y;
    if (messages.length > 8)
      sevenDaysCount =
        messages[messages.length - 1]!.y - messages[messages.length - 7]!.y;
    if (messages.length > 3)
      oneDayCount =
        messages[messages.length - 1]!.y - messages[messages.length - 2]!.y;

    return {
      mostActiveTextChannelId,
      mostActiveTextChannelMessageCount,
      lookbackDaysCount,
      oneDayCount,
      sevenDaysCount,
    };
  }
}
