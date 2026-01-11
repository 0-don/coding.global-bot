import { topStatsExampleEmbed } from "@/bot/embeds/top-stats.embed";
import { userStatsExampleEmbed } from "@/bot/embeds/user-stats.embed";
import { mapMemberGuild } from "@/shared/mappers/discord.mapper";
import { StatsQueryService } from "./stats-query.service";
import {
  bigintToNumber,
  secondsToHours,
  sumSeconds,
  sumToHours,
} from "./stats.utils";

export class StatsService {
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
      StatsQueryService.getTopMessageUsers(guildId, lastDaysCount, limit),
      StatsQueryService.getTopHelpfulUsers(guildId, lastDaysCount, limit),
      StatsQueryService.getTopMessageChannels(guildId, lastDaysCount, limit),
      StatsQueryService.getTopVoiceUsers(guildId, lastDaysCount, limit),
      StatsQueryService.getTopVoiceChannels(guildId, lastDaysCount, limit),
      StatsQueryService.getTotalMessages(guildId, lastDaysCount),
      StatsQueryService.getTotalVoiceHours(guildId, lastDaysCount),
    ]);

    return {
      mostActiveMessageUsers: mostActiveMessageUsers.map(bigintToNumber),
      mostHelpfulUsers: mostHelpfulUsers.map(bigintToNumber),
      mostActiveMessageChannels: mostActiveMessageChannels.map(bigintToNumber),
      mostActiveVoiceUsers: mostActiveVoiceUsers.map(sumToHours),
      mostActiveVoiceChannels: mostActiveVoiceChannels.map(sumToHours),
      totalMessages: Number(totalMessagesResult[0]?.total ?? 0),
      totalVoiceHours: Math.round(
        secondsToHours(totalVoiceHoursResult[0]?.total ?? 0),
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
        StatsQueryService.getUserVoiceStats(memberId, guildId, lookback),
        StatsQueryService.getUserVoiceStats(memberId, guildId, "7 days"),
        StatsQueryService.getUserVoiceStats(memberId, guildId, "1 day"),
      ]);

    const mostActiveVoice = {
      ...voiceStatsLookback?.[0],
      sum: secondsToHours(Number(voiceStatsLookback?.[0]?.sum ?? 0)),
    };

    return {
      mostActiveVoice,
      lookbackVoiceSum: secondsToHours(sumSeconds(voiceStatsLookback)),
      sevenDayVoiceSum: secondsToHours(sumSeconds(voiceStatsSevenDays)),
      oneDayVoiceSum: secondsToHours(sumSeconds(voiceStatsOneDay)),
    };
  }

  static async getUserStats(memberId: string, guildId: string) {
    const memberGuild = await StatsQueryService.getMemberGuild(
      memberId,
      guildId,
    );
    if (!memberGuild) return null;

    const [
      lastVoice,
      lastMessage,
      helpCount,
      helpReceivedCount,
      messagesStats,
      voiceStats,
    ] = await Promise.all([
      StatsQueryService.getLastVoiceEvent(memberId, guildId),
      StatsQueryService.getLastMessage(memberId, guildId),
      StatsQueryService.getHelpCount(memberId, guildId),
      StatsQueryService.getHelpReceivedCount(memberId, guildId),
      StatsService.messagesStats(memberId, guildId, memberGuild.lookback),
      StatsService.voiceStats(memberId, guildId, memberGuild.lookback),
    ]);

    return {
      user: mapMemberGuild(memberGuild, guildId),
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
          lastVoice: lastVoice?.join?.toISOString() || null,
          lastMessage: lastMessage?.createdAt?.toISOString() || null,
        },
      },
      lookback: memberGuild.lookback,
    };
  }

  static async messagesStats(
    memberId: string,
    guildId: string,
    lookback: number,
  ) {
    const [mostActiveTextChannel, lookbackCount, sevenDaysCount, oneDayCount] =
      await Promise.all([
        StatsQueryService.getUserMostActiveTextChannel(memberId, guildId),
        StatsQueryService.getUserMessageCount(memberId, guildId, lookback),
        StatsQueryService.getUserMessageCount(memberId, guildId, 7),
        StatsQueryService.getUserMessageCount(memberId, guildId, 1),
      ]);

    return {
      mostActiveTextChannelId: mostActiveTextChannel?.[0]?.channelId,
      mostActiveTextChannelMessageCount: Number(
        mostActiveTextChannel?.[0]?.count ?? 0,
      ),
      lookbackDaysCount: lookbackCount,
      oneDayCount,
      sevenDaysCount,
    };
  }
}
