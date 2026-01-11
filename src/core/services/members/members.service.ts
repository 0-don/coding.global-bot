import { simpleEmbedExample } from "@/core/embeds/simple.embed";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/prisma";
import {
  JOIN_EVENT_CHANNELS,
  MEMBERS_COUNT_CHANNELS,
} from "@/shared/config/channels";
import { SHOULD_COUNT_MEMBERS } from "@/shared/config/features";
import { ConfigValidator } from "@/shared/config/validator";
import { generateChart } from "@/shared/utils/chart.utils";
import { getDaysArray } from "@/shared/utils/date.utils";
import { ChartDataPoint, GuildMemberCountChart } from "@/types";
import { log } from "console";
import dayjs from "dayjs";
import {
  Guild,
  GuildMember,
  PartialGuildMember,
  TextChannel,
  VoiceState,
} from "discord.js";

export class MembersService {
  private static _memberCountWarningLogged = false;

  static async upsertDbMember(
    member: GuildMember | PartialGuildMember,
    status: "join" | "leave",
  ) {
    // dont add bots to the list
    if (member.user.bot) return;

    if (!ConfigValidator.isFeatureEnabled("SHOULD_COUNT_MEMBERS")) {
      if (!this._memberCountWarningLogged) {
        ConfigValidator.logFeatureDisabled(
          "Member Count Display",
          "SHOULD_COUNT_MEMBERS",
        );
        this._memberCountWarningLogged = true;
      }
      return;
    }

    if (!ConfigValidator.isFeatureEnabled("MEMBERS_COUNT_CHANNELS")) {
      if (!this._memberCountWarningLogged) {
        ConfigValidator.logFeatureDisabled(
          "Member Count Display",
          "MEMBERS_COUNT_CHANNELS",
        );
        this._memberCountWarningLogged = true;
      }
      return;
    }

    // get member info
    const memberId = member.id;
    const guildId = member.guild.id;
    const username = member.user.username;

    // create member db input
    const dbMemberInput: Prisma.MemberCreateInput = {
      memberId,
      username,
    };

    // create or update member, fetch roles if exist
    const dbMember = await prisma.member.upsert({
      where: { memberId: dbMemberInput.memberId },
      create: dbMemberInput,
      update: dbMemberInput,
      include: { roles: true },
    });

    // create member guild db input
    const dbMemberGuildInput: Prisma.MemberGuildUncheckedCreateInput = {
      memberId,
      guildId,
      status: status === "join",
      ...(status === "leave" && {
        presenceStatus: "offline",
        presenceUpdatedAt: new Date(),
      }),
    };

    // create or update member guild
    await prisma.memberGuild.upsert({
      where: { member_guild: { memberId, guildId } },
      create: dbMemberGuildInput,
      update: dbMemberGuildInput,
    });

    // if user joined and already has db roles assign them
    if (status === "join" && dbMember.roles.length)
      for (let role of dbMember.roles) {
        if (member.roles.cache.has(role.roleId)) continue;

        const roleToAdd = member.guild.roles.cache.get(role.roleId);
        if (!roleToAdd || !roleToAdd.editable) {
          continue;
        }

        try {
          await member.roles.add(role.roleId);
        } catch (error) {
          await prisma.memberRole.delete({
            where: { member_role: { memberId, roleId: role.roleId } },
          });
        }
      }

    // return user
    return dbMember;
  }

  static async logJoinLeaveEvents(
    member: GuildMember,
    event: "join" | "leave",
  ) {
    try {
      if (!ConfigValidator.isFeatureEnabled("JOIN_EVENT_CHANNELS")) {
        return;
      }

      // get voice channel by name
      const joinEventsChannel = member.guild.channels.cache.find(({ name }) =>
        JOIN_EVENT_CHANNELS.includes(name),
      );

      // check if voice channel exists and it is voice channel
      if (!joinEventsChannel || !joinEventsChannel.isTextBased()) return;

      const userServerName = member?.user.toString();
      const userGlobalName = member?.user.username;

      // copy paste embed so it doesnt get overwritten
      const joinEmbed = simpleEmbedExample();

      if (event === "join") {
        joinEmbed.description = `${userServerName} (${userGlobalName}) joined the server ✅`;
        joinEmbed.footer!.text = "join";
      } else {
        joinEmbed.description = `${userServerName} (${userGlobalName}) left the server 🚪`;
        joinEmbed.footer!.text = "leave";
      }

      // send embed event to voice channel
      (joinEventsChannel as TextChannel).send({
        embeds: [joinEmbed],
        allowedMentions: { users: [], roles: [] },
      });
    } catch (_) {}
  }

  static async updateMemberCount(member: GuildMember | PartialGuildMember) {
    if (member.user.bot || !SHOULD_COUNT_MEMBERS) return;

    // await member count - use cache if fetch fails due to rate limit
    try {
      await member.guild.members.fetch();
    } catch {
      // Rate limited, continue with cached members
    }

    for (const channelName of MEMBERS_COUNT_CHANNELS) {
      // find member: channel
      const memberCountChannel = member.guild.channels.cache.find((channel) =>
        channel.name.includes(channelName),
      );

      // if no channel return
      if (!memberCountChannel) continue;

      // count members exc
      const memberCount = member.guild.members.cache.filter(
        (member) => !member.user.bot,
      ).size;

      // set channel name as member count
      try {
        await memberCountChannel.setName(`${channelName} ${memberCount}`);
      } catch (_) {}
    }
  }

  // Shared logic for computing member stats and generating chart
  private static async computeMemberStats(guild: Guild) {
    const guildId = guild.id;
    const guildName = guild.name;

    // create or update guild
    const { lookback } = await prisma.guild.upsert({
      where: { guildId },
      create: { guildId, guildName },
      update: { guildName },
    });

    // get member join dates and sort ascending - use cache if fetch fails due to rate limit
    let members;
    try {
      members = await guild.members.fetch();
    } catch {
      // Rate limited, use cached members
      members = guild.members.cache;
    }
    const dates = members
      .map((member) => member.joinedAt || new Date())
      .sort((a, b) => a.getTime() - b.getTime());

    // if no dates, return null
    if (!dates[0]) return null;

    // create date array from first to today for each day
    const startEndDateArray = getDaysArray(
      dates[0],
      dayjs().add(1, "day").toDate(),
    );

    // O(n) algorithm: use sorted dates with a running pointer instead of O(n²) filter
    const datesArray = Array.from(dates);
    let datePointer = 0;
    const data: ChartDataPoint[] = [];

    for (const date of startEndDateArray) {
      const currentDay = dayjs(date);
      // Move pointer forward while dates are <= current day
      while (
        datePointer < datesArray.length &&
        dayjs(datesArray[datePointer]) <= currentDay
      ) {
        datePointer++;
      }
      data.push({
        x: currentDay.toDate(),
        y: datePointer,
      });
    }

    let thirtyDaysCount = data[data.length - 1]?.y ?? 0;
    let sevenDaysCount = data[data.length - 1]?.y ?? 0;
    let oneDayCount = data[data.length - 1]?.y ?? 0;

    // count total members for date ranges
    if (data.length > 31)
      thirtyDaysCount = data[data.length - 1]!.y - data[data.length - 30]!.y;
    if (data.length > 8)
      sevenDaysCount = data[data.length - 1]!.y - data[data.length - 7]!.y;
    if (data.length > 3)
      oneDayCount = data[data.length - 1]!.y - data[data.length - 2]!.y;

    return {
      guildId,
      guildName,
      lookback,
      data,
      thirtyDaysCount,
      sevenDaysCount,
      oneDayCount,
      memberCount: data[data.length - 1]?.y ?? 0,
    };
  }

  // Generate chart and return buffer
  private static async generateChartBuffer(
    data: ChartDataPoint[],
    lookback: number,
  ): Promise<Buffer> {
    const sliceStart = data.length - 2 < lookback ? 0 : -lookback;
    return generateChart(data.slice(sliceStart));
  }

  static async guildMemberCountChart(
    guild: Guild,
  ): Promise<GuildMemberCountChart> {
    const stats = await this.computeMemberStats(guild);

    if (!stats) return { error: "No members found" };

    const buffer = await this.generateChartBuffer(stats.data, stats.lookback);

    log(`Created guild member count ${stats.guildName}`);

    return {
      buffer,
      fileName: `${stats.guildId}.png`,
      thirtyDaysCount: stats.thirtyDaysCount,
      sevedDaysCount: stats.sevenDaysCount,
      oneDayCount: stats.oneDayCount,
      lookback: stats.lookback,
    };
  }

  // Returns member stats with base64 chart for API usage
  static async getMembersStatsForApi(guild: Guild) {
    const stats = await this.computeMemberStats(guild);

    if (!stats) {
      const { lookback } = (await prisma.guild.findUnique({
        where: { guildId: guild.id },
        select: { lookback: true },
      })) ?? { lookback: 9999 };

      return {
        thirtyDaysCount: 0,
        sevenDaysCount: 0,
        oneDayCount: 0,
        lookback,
        memberCount: 0,
        chart: "",
      };
    }

    const buffer = await this.generateChartBuffer(stats.data, stats.lookback);
    const base64Chart = `data:image/png;base64,${buffer.toString("base64")}`;

    log(`Created guild member count for API ${stats.guildName}`);

    return {
      thirtyDaysCount: stats.thirtyDaysCount,
      sevenDaysCount: stats.sevenDaysCount,
      oneDayCount: stats.oneDayCount,
      lookback: stats.lookback,
      memberCount: stats.memberCount,
      chart: base64Chart,
    };
  }

  // Lookback methods
  static async setMemberLookback(
    memberId: string,
    guildId: string,
    lookback: number,
  ): Promise<void> {
    await prisma.memberGuild.upsert({
      where: { member_guild: { guildId, memberId } },
      create: { guildId, lookback, memberId, status: true },
      update: { guildId, lookback, memberId, status: true },
    });
  }

  static async setGuildLookback(
    guildId: string,
    guildName: string,
    lookback: number,
  ): Promise<void> {
    await prisma.guild.upsert({
      where: { guildId },
      create: { guildId, guildName, lookback },
      update: { guildName, lookback },
    });
  }

  // Nickname methods
  static async updateNickname(
    oldMember: GuildMember | PartialGuildMember,
    newMember: GuildMember | PartialGuildMember,
  ) {
    if (oldMember.user.bot) return;

    if (oldMember.nickname !== newMember.nickname) {
      const memberGuild = await prisma.memberGuild.findFirst({
        where: {
          guildId: newMember.guild.id,
          memberId: newMember.id,
        },
      });
      if (memberGuild) {
        await prisma.memberGuild.update({
          where: { id: memberGuild.id },
          data: { nickname: newMember.nickname },
        });
      }
    }
  }

  static async joinSettings(
    member: GuildMember | PartialGuildMember,
    voiceState?: VoiceState,
  ) {
    // dont add bots to the list
    if (member && member?.user?.bot) return;

    const guildMember = await prisma.memberGuild.findFirst({
      where: {
        guildId: voiceState?.guild.id || member?.guild.id,
        memberId: member?.id || voiceState?.member?.id,
      },
    });

    if (guildMember && member) {
      member = member.partial ? await member.fetch() : member;

      if (guildMember.nickname && guildMember.nickname !== member.nickname) {
        await member.setNickname(guildMember.nickname);
      }

      if (voiceState?.channelId) {
        if (member.voice.serverMute !== guildMember.muted)
          await member.voice.setMute(guildMember.muted);

        if (member.voice.serverDeaf !== guildMember.deafened)
          await member.voice.setDeaf(guildMember.deafened);
      }
    }
  }
}
