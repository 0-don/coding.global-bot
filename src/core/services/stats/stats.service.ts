import dayjs from "dayjs";
import { topStatsExampleEmbed } from "@/core/embeds/top-stats.embed";
import { userStatsExampleEmbed } from "@/core/embeds/user-stats.embed";
import { mapMemberGuild } from "@/shared/mappers/discord.mapper";
import {
  bigintToNumber,
  secondsToHours,
  sumSeconds,
  sumToHours,
} from "@/shared/utils/format.utils";
import { db } from "@/lib/db";
import { memberMessages, guildVoiceEvents, memberHelper, memberGuild } from "@/lib/db-schema";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";

export class StatsService {
  // Query methods
  private static async getTopMessageUsers(
    guildId: string,
    lastDaysCount: number,
    limit: number,
  ) {
    return db.execute(sql`
      SELECT "MemberMessages"."memberId", "Member"."username", count("MemberMessages"."memberId")
      FROM "MemberMessages"
      LEFT JOIN "Member" ON "Member"."memberId" = "MemberMessages"."memberId"
      INNER JOIN "MemberGuild" ON "MemberGuild"."memberId" = "MemberMessages"."memberId"
        AND "MemberGuild"."guildId" = "MemberMessages"."guildId"
        AND "MemberGuild"."status" = true
      WHERE "MemberMessages"."guildId" = ${guildId}
      AND "MemberMessages"."createdAt" > (NOW() - ${`${lastDaysCount} days`}::interval)
      GROUP BY "MemberMessages"."memberId", "Member"."username"
      ORDER BY count(*) DESC
      LIMIT ${limit}`) as Promise<
      { memberId: string; count: bigint; username: string }[]
    >;
  }

  private static async getTopHelpfulUsers(
    guildId: string,
    lastDaysCount: number,
    limit: number,
  ) {
    return db.execute(sql`
      SELECT "MemberHelper"."memberId", "Member"."username", count(*)
      FROM "MemberHelper"
      LEFT JOIN "Member" ON "Member"."memberId" = "MemberHelper"."memberId"
      INNER JOIN "MemberGuild" ON "MemberGuild"."memberId" = "MemberHelper"."memberId"
        AND "MemberGuild"."guildId" = "MemberHelper"."guildId"
        AND "MemberGuild"."status" = true
      WHERE "MemberHelper"."guildId" = ${guildId}
      AND "MemberHelper"."createdAt" > (NOW() - ${`${lastDaysCount} days`}::interval)
      GROUP BY "MemberHelper"."memberId", "Member"."username"
      ORDER BY count(*) DESC
      LIMIT ${limit}`) as Promise<
      { memberId: string; count: bigint; username: string }[]
    >;
  }

  private static async getTopMessageChannels(
    guildId: string,
    lastDaysCount: number,
    limit: number,
  ) {
    return db.execute(sql`
      SELECT "channelId", count(*)
      FROM "MemberMessages"
      WHERE "guildId" = ${guildId}
      AND "createdAt" > (NOW() - ${`${lastDaysCount} days`}::interval)
      GROUP BY "channelId"
      ORDER BY count(*) DESC
      LIMIT ${limit}`) as Promise<{ channelId: string; count: bigint }[]>;
  }

  private static async getTopVoiceUsers(
    guildId: string,
    lastDaysCount: number,
    limit: number,
  ) {
    return db.execute(sql`
      SELECT t."memberId", "Member"."username", SUM(difference) AS sum
      FROM (
          SELECT
          "memberId",
          "guildId",
          EXTRACT(EPOCH FROM (COALESCE("leave", CURRENT_TIMESTAMP) - "join")) AS difference
          FROM "GuildVoiceEvents"
          WHERE "guildId" = ${guildId}
          AND "join" > (NOW() - ${`${lastDaysCount} days`}::interval)) AS t
      JOIN "Member" ON "Member"."memberId" = t."memberId"
      INNER JOIN "MemberGuild" ON "MemberGuild"."memberId" = t."memberId"
        AND "MemberGuild"."guildId" = t."guildId"
        AND "MemberGuild"."status" = true
      GROUP BY t."memberId", "Member"."username"
      ORDER BY "sum" DESC
      LIMIT ${limit}`) as Promise<
      { memberId: string; username: string; sum: number }[]
    >;
  }

  private static async getTopVoiceChannels(
    guildId: string,
    lastDaysCount: number,
    limit: number,
  ) {
    return db.execute(sql`
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
      LIMIT ${limit}`) as Promise<{ channelId: string; sum: number }[]>;
  }

  private static async getTotalMessages(
    guildId: string,
    lastDaysCount: number,
  ) {
    const result = await db.execute(sql`
      SELECT count(*) as total
      FROM "MemberMessages"
      WHERE "guildId" = ${guildId}
      AND "createdAt" > (NOW() - ${`${lastDaysCount} days`}::interval)`);
    return (result as unknown as { total: bigint }[])[0];
  }

  private static async getTotalVoiceHours(
    guildId: string,
    lastDaysCount: number,
  ) {
    const result = await db.execute(sql`
      SELECT COALESCE(SUM(difference), 0) AS total
      FROM (
          SELECT
          EXTRACT(EPOCH FROM (COALESCE("leave", CURRENT_TIMESTAMP) - "join")) AS difference
          FROM "GuildVoiceEvents"
          WHERE "guildId" = ${guildId}
          AND "join" > (NOW() - ${`${lastDaysCount} days`}::interval)) AS t`);
    return (result as unknown as { total: number }[])[0];
  }

  private static async getUserVoiceStats(
    memberId: string,
    guildId: string,
    lookbackDays: number | string,
  ) {
    const interval =
      typeof lookbackDays === "number" ? `${lookbackDays} day` : lookbackDays;
    return db.execute(sql`
      SELECT "channelId", SUM(difference) AS sum
      FROM (
          SELECT
          "channelId",
          EXTRACT(EPOCH FROM (COALESCE("leave", CURRENT_TIMESTAMP) - "join")) AS difference
          FROM "GuildVoiceEvents"
          WHERE "memberId" = ${memberId}
            AND "guildId" = ${guildId}
            AND "join" > (NOW() - ${interval}::interval)
          ) AS t
      GROUP BY "channelId"
      ORDER BY "sum" DESC`) as Promise<{ channelId: string; sum: number }[]>;
  }

  private static async getUserMostActiveTextChannel(
    memberId: string,
    guildId: string,
  ) {
    return db.execute(sql`
      SELECT "channelId", count(*)
      FROM "MemberMessages"
      WHERE "memberId" = ${memberId} AND "guildId" = ${guildId}
      GROUP BY "channelId"
      ORDER BY count(*) DESC
      LIMIT 1`) as Promise<{ channelId: string; count: bigint }[]>;
  }

  private static async getUserMessageCount(
    memberId: string,
    guildId: string,
    days: number,
  ) {
    const [result] = await db
      .select({ count: count() })
      .from(memberMessages)
      .where(
        and(
          eq(memberMessages.memberId, memberId),
          eq(memberMessages.guildId, guildId),
          gte(memberMessages.createdAt, dayjs().subtract(days, "day").toISOString()),
        )
      );
    return result?.count ?? 0;
  }

  private static async getLastVoiceEvent(memberId: string, guildId: string) {
    return db.query.guildVoiceEvents.findFirst({
      where: and(
        eq(guildVoiceEvents.guildId, guildId),
        eq(guildVoiceEvents.memberId, memberId),
      ),
      orderBy: desc(guildVoiceEvents.id),
    });
  }

  private static async getLastMessage(memberId: string, guildId: string) {
    return db.query.memberMessages.findFirst({
      where: and(
        eq(memberMessages.guildId, guildId),
        eq(memberMessages.memberId, memberId),
      ),
      orderBy: desc(memberMessages.id),
    });
  }

  private static async getHelpCount(memberId: string, guildId: string) {
    const [result] = await db
      .select({ count: count() })
      .from(memberHelper)
      .where(
        and(
          eq(memberHelper.guildId, guildId),
          eq(memberHelper.memberId, memberId),
        )
      );
    return result?.count ?? 0;
  }

  private static async getHelpReceivedCount(memberId: string, guildId: string) {
    const [result] = await db
      .select({ count: count() })
      .from(memberHelper)
      .where(
        and(
          eq(memberHelper.guildId, guildId),
          eq(memberHelper.threadOwnerId, memberId),
        )
      );
    return result?.count ?? 0;
  }

  private static async getMemberGuild(memberId: string, guildId: string) {
    return db.query.memberGuild.findFirst({
      where: and(
        eq(memberGuild.memberId, memberId),
        eq(memberGuild.guildId, guildId),
      ),
      with: {
        member: {
          with: { memberRoles: true },
        },
      },
    });
  }

  // Public methods
  static async getTopStats(
    guildId: string,
    lastDaysCount: number = 9999,
    limit: number = 10,
  ) {
    const [
      mostActiveMessageUsers,
      mostHelpfulUsers,
      mostActiveMessageChannels,
      mostActiveVoiceUsers,
      mostActiveVoiceChannels,
      totalMessagesResult,
      totalVoiceHoursResult,
    ] = await Promise.all([
      StatsService.getTopMessageUsers(guildId, lastDaysCount, limit),
      StatsService.getTopHelpfulUsers(guildId, lastDaysCount, limit),
      StatsService.getTopMessageChannels(guildId, lastDaysCount, limit),
      StatsService.getTopVoiceUsers(guildId, lastDaysCount, limit),
      StatsService.getTopVoiceChannels(guildId, lastDaysCount, limit),
      StatsService.getTotalMessages(guildId, lastDaysCount),
      StatsService.getTotalVoiceHours(guildId, lastDaysCount),
    ]);

    return {
      mostActiveMessageUsers: (mostActiveMessageUsers as any[]).map(bigintToNumber),
      mostHelpfulUsers: (mostHelpfulUsers as any[]).map(bigintToNumber),
      mostActiveMessageChannels: (mostActiveMessageChannels as any[]).map(bigintToNumber),
      mostActiveVoiceUsers: (mostActiveVoiceUsers as any[]).map(sumToHours),
      mostActiveVoiceChannels: (mostActiveVoiceChannels as any[]).map(sumToHours),
      totalMessages: Number(totalMessagesResult?.total ?? 0),
      totalVoiceHours: Math.round(
        secondsToHours(totalVoiceHoursResult?.total ?? 0),
      ),
      lookback: lastDaysCount,
    };
  }

  static async topStatsEmbed(guildId: string, lastDaysCount: number = 9999) {
    const data = await this.getTopStats(guildId, lastDaysCount);
    return topStatsExampleEmbed(data);
  }

  static async getUserStatsEmbed(memberId: string, guildId: string) {
    const statsData = await StatsService.getUserStats(memberId, guildId);
    if (!statsData) return null;

    const embed = userStatsExampleEmbed({
      id: memberId,
      helpCount: statsData.stats.help.given,
      helpReceivedCount: statsData.stats.help.received,
      userGlobalName: statsData.user.username,
      userServerName: `<@${memberId}>`,
      lookback: statsData.lookback,
      createdAt: new Date(statsData.user.createdAt ?? Date.now()),
      joinedAt: statsData.user.joinedAt
        ? new Date(statsData.user.joinedAt)
        : null,
      lookbackDaysCount: statsData.stats.messages.total,
      oneDayCount: statsData.stats.messages.last24Hours,
      sevenDaysCount: statsData.stats.messages.last7Days,
      mostActiveTextChannelId:
        statsData.stats.messages.mostActiveChannel.id ?? undefined,
      mostActiveTextChannelMessageCount:
        statsData.stats.messages.mostActiveChannel.count,
      lastMessageAt: statsData.stats.lastActivity.lastMessage,
      lastVoiceAt: statsData.stats.lastActivity.lastVoice,
      mostActiveVoice: {
        channelId: statsData.stats.voice.mostActiveChannel.id ?? "",
        sum: statsData.stats.voice.mostActiveChannel.hours,
      },
      lookbackVoiceSum: statsData.stats.voice.totalHours,
      sevenDayVoiceSum: statsData.stats.voice.last7DaysHours,
      oneDayVoiceSum: statsData.stats.voice.last24HoursHours,
    });

    return { embed, roles: statsData.user.roles.map((role) => role.name) };
  }

  static async voiceStats(memberId: string, guildId: string, lookback: number) {
    const [voiceStatsLookback, voiceStatsSevenDays, voiceStatsOneDay] =
      await Promise.all([
        StatsService.getUserVoiceStats(memberId, guildId, lookback),
        StatsService.getUserVoiceStats(memberId, guildId, "7 days"),
        StatsService.getUserVoiceStats(memberId, guildId, "1 day"),
      ]);

    const mostActiveVoice = {
      ...(voiceStatsLookback as any)?.[0],
      sum: secondsToHours(Number((voiceStatsLookback as any)?.[0]?.sum ?? 0)),
    };

    return {
      mostActiveVoice,
      lookbackVoiceSum: secondsToHours(sumSeconds(voiceStatsLookback as any)),
      sevenDayVoiceSum: secondsToHours(sumSeconds(voiceStatsSevenDays as any)),
      oneDayVoiceSum: secondsToHours(sumSeconds(voiceStatsOneDay as any)),
    };
  }

  static async getUserStats(memberId: string, guildId: string) {
    const memberGuildData = await StatsService.getMemberGuild(memberId, guildId);
    if (!memberGuildData) return null;

    const [
      lastVoice,
      lastMessage,
      helpCount,
      helpReceivedCount,
      messagesStats,
      voiceStats,
    ] = await Promise.all([
      StatsService.getLastVoiceEvent(memberId, guildId),
      StatsService.getLastMessage(memberId, guildId),
      StatsService.getHelpCount(memberId, guildId),
      StatsService.getHelpReceivedCount(memberId, guildId),
      StatsService.messagesStats(memberId, guildId, memberGuildData.lookback),
      StatsService.voiceStats(memberId, guildId, memberGuildData.lookback),
    ]);

    return {
      user: mapMemberGuild(memberGuildData, guildId),
      stats: {
        messages: {
          total: messagesStats.lookbackDaysCount,
          last7Days: messagesStats.sevenDaysCount,
          last24Hours: messagesStats.oneDayCount,
          mostActiveChannel: {
            id: messagesStats.mostActiveTextChannelId || null,
            count: messagesStats.mostActiveTextChannelMessageCount,
          },
        },
        voice: {
          totalHours: voiceStats.lookbackVoiceSum,
          last7DaysHours: voiceStats.sevenDayVoiceSum,
          last24HoursHours: voiceStats.oneDayVoiceSum,
          mostActiveChannel: {
            id: voiceStats.mostActiveVoice?.channelId || null,
            hours: voiceStats.mostActiveVoice?.sum || 0,
          },
        },
        help: {
          given: helpCount,
          received: helpReceivedCount,
        },
        lastActivity: {
          lastVoice: lastVoice?.join || null,
          lastMessage: lastMessage?.createdAt || null,
        },
      },
      lookback: memberGuildData.lookback,
    };
  }

  static async messagesStats(
    memberId: string,
    guildId: string,
    lookback: number,
  ) {
    const [mostActiveTextChannel, lookbackCount, sevenDaysCount, oneDayCount] =
      await Promise.all([
        StatsService.getUserMostActiveTextChannel(memberId, guildId),
        StatsService.getUserMessageCount(memberId, guildId, lookback),
        StatsService.getUserMessageCount(memberId, guildId, 7),
        StatsService.getUserMessageCount(memberId, guildId, 1),
      ]);

    return {
      mostActiveTextChannelId: (mostActiveTextChannel as any)?.[0]?.channelId,
      mostActiveTextChannelMessageCount: Number(
        (mostActiveTextChannel as any)?.[0]?.count ?? 0,
      ),
      lookbackDaysCount: lookbackCount,
      oneDayCount,
      sevenDaysCount,
    };
  }
}
