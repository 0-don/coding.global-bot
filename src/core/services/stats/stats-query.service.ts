import dayjs from "dayjs";
import { prisma } from "@/prisma";

export class StatsQueryService {
  static async getTopMessageUsers(
    guildId: string,
    lastDaysCount: number,
    limit: number,
  ) {
    return prisma.$queryRaw`
      SELECT "MemberMessages"."memberId", "Member"."username", count("MemberMessages"."memberId")
      FROM "MemberMessages"
      LEFT JOIN "Member" ON "Member"."memberId" = "MemberMessages"."memberId"
      WHERE "MemberMessages"."guildId" = ${guildId}
      AND "MemberMessages"."createdAt" > (NOW() - ${`${lastDaysCount} days`}::interval)
      GROUP BY "MemberMessages"."memberId", "Member"."username"
      ORDER BY count(*) DESC
      LIMIT ${limit}` as Promise<
      { memberId: string; count: bigint; username: string }[]
    >;
  }

  static async getTopHelpfulUsers(
    guildId: string,
    lastDaysCount: number,
    limit: number,
  ) {
    return prisma.$queryRaw`
      SELECT "MemberHelper"."memberId", "Member"."username", count(*)
      FROM "MemberHelper"
      LEFT JOIN "Member" ON "Member"."memberId" = "MemberHelper"."memberId"
      WHERE "MemberHelper"."guildId" = ${guildId}
      AND "MemberHelper"."createdAt" > (NOW() - ${`${lastDaysCount} days`}::interval)
      GROUP BY "MemberHelper"."memberId", "Member"."username"
      ORDER BY count(*) DESC
      LIMIT ${limit}` as Promise<
      { memberId: string; count: bigint; username: string }[]
    >;
  }

  static async getTopMessageChannels(
    guildId: string,
    lastDaysCount: number,
    limit: number,
  ) {
    return prisma.$queryRaw`
      SELECT "channelId", count(*)
      FROM "MemberMessages"
      WHERE "guildId" = ${guildId}
      AND "createdAt" > (NOW() - ${`${lastDaysCount} days`}::interval)
      GROUP BY "channelId"
      ORDER BY count(*) DESC
      LIMIT ${limit}` as Promise<{ channelId: string; count: bigint }[]>;
  }

  static async getTopVoiceUsers(
    guildId: string,
    lastDaysCount: number,
    limit: number,
  ) {
    return prisma.$queryRaw`
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
    >;
  }

  static async getTopVoiceChannels(
    guildId: string,
    lastDaysCount: number,
    limit: number,
  ) {
    return prisma.$queryRaw`
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
      LIMIT ${limit}` as Promise<{ channelId: string; sum: number }[]>;
  }

  static async getTotalMessages(guildId: string, lastDaysCount: number) {
    return prisma.$queryRaw`
      SELECT count(*) as total
      FROM "MemberMessages"
      WHERE "guildId" = ${guildId}
      AND "createdAt" > (NOW() - ${`${lastDaysCount} days`}::interval)` as Promise<
      [{ total: bigint }]
    >;
  }

  static async getTotalVoiceHours(guildId: string, lastDaysCount: number) {
    return prisma.$queryRaw`
      SELECT COALESCE(SUM(difference), 0) AS total
      FROM (
          SELECT
          EXTRACT(EPOCH FROM (COALESCE("leave", CURRENT_TIMESTAMP) - "join")) AS difference
          FROM "GuildVoiceEvents"
          WHERE "guildId" = ${guildId}
          AND "join" > (NOW() - ${`${lastDaysCount} days`}::interval)) AS t` as Promise<
      [{ total: number }]
    >;
  }

  static async getUserVoiceStats(
    memberId: string,
    guildId: string,
    lookbackDays: number | string,
  ) {
    const interval =
      typeof lookbackDays === "number" ? `${lookbackDays} day` : lookbackDays;
    return prisma.$queryRaw`
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
      ORDER BY "sum" DESC` as Promise<{ channelId: string; sum: number }[]>;
  }

  static async getUserMostActiveTextChannel(memberId: string, guildId: string) {
    return prisma.$queryRaw`
      SELECT "channelId", count(*)
      FROM "MemberMessages"
      WHERE "memberId" = ${memberId} AND "guildId" = ${guildId}
      GROUP BY "channelId"
      ORDER BY count(*) DESC
      LIMIT 1` as Promise<{ channelId: string; count: bigint }[]>;
  }

  static async getUserMessageCount(
    memberId: string,
    guildId: string,
    days: number,
  ) {
    return prisma.memberMessages.count({
      where: {
        memberId,
        guildId,
        createdAt: { gte: dayjs().subtract(days, "day").toDate() },
      },
    });
  }

  static async getLastVoiceEvent(memberId: string, guildId: string) {
    return prisma.guildVoiceEvents.findFirst({
      where: { guildId, memberId },
      orderBy: { id: "desc" },
    });
  }

  static async getLastMessage(memberId: string, guildId: string) {
    return prisma.memberMessages.findFirst({
      where: { guildId, memberId },
      orderBy: { id: "desc" },
    });
  }

  static async getHelpCount(memberId: string, guildId: string) {
    return prisma.memberHelper.count({
      where: { guildId, memberId },
    });
  }

  static async getHelpReceivedCount(memberId: string, guildId: string) {
    return prisma.memberHelper.count({
      where: { guildId, threadOwnerId: memberId },
    });
  }

  static async getMemberGuild(memberId: string, guildId: string) {
    return prisma.memberGuild.findUnique({
      where: { member_guild: { memberId, guildId } },
      include: { member: { include: { roles: true } } },
    });
  }
}
