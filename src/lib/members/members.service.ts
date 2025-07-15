import { Prisma } from "@prisma/client";
import { Chart } from "chart.js";
import { log } from "console";
import dayjs from "dayjs";
import {
  Guild,
  GuildMember,
  PartialGuildMember,
  TextChannel,
} from "discord.js";
import { writeFileSync } from "fs";
import path from "path";
import { prisma } from "../../prisma";
import { ChartDataset, GuildMemberCountChart } from "../../types/index";
import { ConfigValidator } from "../config-validator";
import {
  CHARTJS_NODE_CANVAS,
  ChartManager,
  GLOBAL_CANVAS,
  JOIN_EVENT_CHANNELS,
  MEMBERS_COUNT_CHANNELS,
  SHOULD_COUNT_MEMBERS,
} from "../constants";
import { simpleEmbedExample } from "../embeds";
import { chartConfig, getDaysArray } from "../helpers";

export class MembersService {
  private static _memberCountWarningLogged = false;

  static async upsertDbMember(
    member: GuildMember | PartialGuildMember,
    status: "join" | "leave"
  ) {
    // dont add bots to the list
    if (member.user.bot) return;

    if (!ConfigValidator.isFeatureEnabled("SHOULD_COUNT_MEMBERS")) {
      if (!this._memberCountWarningLogged) {
        ConfigValidator.logFeatureDisabled(
          "Member Count Display",
          "SHOULD_COUNT_MEMBERS"
        );
        this._memberCountWarningLogged = true;
      }
      return;
    }

    if (!ConfigValidator.isFeatureEnabled("MEMBERS_COUNT_CHANNELS")) {
      if (!this._memberCountWarningLogged) {
        ConfigValidator.logFeatureDisabled(
          "Member Count Display",
          "MEMBERS_COUNT_CHANNELS"
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
      status: status === "join" ? true : false,
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
    event: "join" | "leave"
  ) {
    try {
      if (!ConfigValidator.isFeatureEnabled("JOIN_EVENT_CHANNELS")) {
        return;
      }

      // get voice channel by name
      const joinEventsChannel = member.guild.channels.cache.find(({ name }) =>
        JOIN_EVENT_CHANNELS.includes(name)
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
        allowedMentions: { users: [] },
      });
    } catch (_) {}
  }

  static async updateMemberCount(member: GuildMember | PartialGuildMember) {
    if (member.user.bot || !SHOULD_COUNT_MEMBERS) return;

    // await member count
    await member.guild.members.fetch();

    for (const channelName of MEMBERS_COUNT_CHANNELS) {
      // find member: channel
      const memberCountChannel = member.guild.channels.cache.find((channel) =>
        channel.name.includes(channelName)
      );

      // if no channel return
      if (!memberCountChannel) continue;

      // count members exc
      const memberCount = member.guild.members.cache.filter(
        (member) => !member.user.bot
      ).size;

      // set channel name as member count
      try {
        await memberCountChannel.setName(`${channelName} ${memberCount}`);
      } catch (_) {}
    }
  }

  static async guildMemberCountChart(
    guild: Guild
  ): Promise<GuildMemberCountChart> {
    // get guild data
    const guildId = guild.id;
    const guildName = guild.name;

    // create or update guild
    const { lookback } = await prisma.guild.upsert({
      where: { guildId },
      create: { guildId, guildName },
      update: { guildName },
    });

    // get member join dates and sort ascending
    const dates = (await guild.members.fetch())
      .map((member) => member.joinedAt || new Date())
      .sort((a, b) => a.getTime() - b.getTime());

    // if no dates, return
    if (!dates[0]) return { error: "No members found" };

    // create date array from first to today for each day
    const startEndDateArray = getDaysArray(
      dates[0],
      dayjs().add(1, "day").toDate()
    );

    // get member count for each day and format it for chartjs
    const data: ChartDataset[] = startEndDateArray.map((date) => ({
      x: dayjs(date).toDate(),
      y: dates.filter((d) => dayjs(d) <= dayjs(date)).length,
    }));

    let thirtyDaysCount = data[data.length - 1]?.y;
    let sevedDaysCount = data[data.length - 1]?.y;
    let oneDayCount = data[data.length - 1]?.y;

    // count total members for date ranges
    if (data.length > 31)
      thirtyDaysCount = data[data.length - 1]!.y - data[data.length - 30]!.y;
    if (data.length > 8)
      sevedDaysCount = data[data.length - 1]!.y - data[data.length - 7]!.y;
    if (data.length > 3)
      oneDayCount = data[data.length - 1]!.y - data[data.length - 2]!.y;

    // create chartjs config
    const config = chartConfig(
      data.slice(
        // splice only the lookback range if it fits. 2 values minium needed for chart
        data.length - 2 < lookback ? 0 : lookback * -1
      ) as any
    );

    ChartManager.destroyChart();
    const chart = new Chart(
      CHARTJS_NODE_CANVAS as unknown as CanvasRenderingContext2D,
      config
    );
    ChartManager.setChart(chart);

    // crete local img file
    const fileName = `${guildId}.png`;
    const imgPath = path.join(path.resolve(), fileName);
    writeFileSync(fileName, GLOBAL_CANVAS.toBuffer("image/png"));

    log(`Created guild member count ${guildName}`);

    // return chart data
    return {
      fileName,
      imgPath,
      thirtyDaysCount,
      sevedDaysCount,
      oneDayCount,
      lookback,
    };
  }
}
