import { Prisma } from "@prisma/client";
import { Chart } from "chart.js";
import { log } from "console";
import dayjs from "dayjs";
import { APIEmbed, Guild, GuildMember, PartialGuildMember, TextChannel } from "discord.js";
import { writeFileSync } from "fs";
import path from "path";
import { prisma } from "../../prisma.js";
import { ChartDataset, GuildMemberCountChart } from "../../types/index.js";
import { CHARTJS_NODE_CANVAS, GLOBAL_CANVAS, JOIN_EVENTS_CHANNEL, MEMBERS_COUNT_CHANNEL } from "../constants.js";
import { simpleEmbedExample } from "../embeds.js";
import { chartConfig, getDaysArray } from "../helpers.js";

export class MembersService {
  static async upsertDbMember(member: GuildMember | PartialGuildMember, status: "join" | "leave") {
    // dont add bots to the list
    if (member.user.bot) return;

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
        try {
          await member.roles.add(role.roleId);
        } catch (error) {
          await prisma.memberRole.delete({ where: { member_role: { memberId, roleId: role.roleId } } });
        }
      }

    // return user
    return dbMember;
  }

  static async logJoinLeaveEvents(member: GuildMember, event: "join" | "leave") {
    try {
      // get voice channel by name
      const joinEventsChannel = member.guild.channels.cache.find(({ name }) => name === JOIN_EVENTS_CHANNEL);

      // check if voice channel exists and it is voice channel
      if (!joinEventsChannel || !joinEventsChannel.isTextBased()) return;

      const userServerName = member?.user.toString();
      const userGlobalName = member?.user.username;

      // copy paste embed so it doesnt get overwritten
      const joinEmbed = JSON.parse(JSON.stringify(simpleEmbedExample)) as APIEmbed;

      // create embed based on event
      joinEmbed.timestamp = new Date().toISOString();

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
    // dont add bots to the list
    if (member.user.bot) return;

    // find member: channel
    const memberCountChannel = member.guild.channels.cache.find((channel) =>
      channel.name.includes(MEMBERS_COUNT_CHANNEL),
    );

    // if no channel return
    if (!memberCountChannel) return;

    // await member count
    await member.guild.members.fetch();

    // count members exc
    const memberCount = member.guild.members.cache.filter((member) => !member.user.bot).size;

    // set channel name as member count
    try {
      await memberCountChannel.setName(`${MEMBERS_COUNT_CHANNEL} ${memberCount}`);
    } catch (_) {}
  }

  static async guildMemberCountChart(guild: Guild): Promise<GuildMemberCountChart> {
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
    const startEndDateArray = getDaysArray(dates[0], dayjs().add(1, "day").toDate());

    // get member count for each day and format it for chartjs
    const data: ChartDataset[] = startEndDateArray.map((date) => ({
      x: dayjs(date).toDate(),
      y: dates.filter((d) => dayjs(d) <= dayjs(date)).length,
    }));

    let thirtyDaysCount = data[data.length - 1]?.y;
    let sevedDaysCount = data[data.length - 1]?.y;
    let oneDayCount = data[data.length - 1]?.y;

    // count total members for date ranges
    if (data.length > 31) thirtyDaysCount = data[data.length - 1]!.y - data[data.length - 30]!.y;
    if (data.length > 8) sevedDaysCount = data[data.length - 1]!.y - data[data.length - 7]!.y;
    if (data.length > 3) oneDayCount = data[data.length - 1]!.y - data[data.length - 2]!.y;

    // const link = await megaUpload(JSON.stringify(data, null, 1), 'chart.json');

    // create chartjs config
    const config = chartConfig(
      data.slice(
        // splice only the lookback range if it fits. 2 values minium needed for chart
        data.length - 2 < lookback ? 0 : lookback * -1,
      ) as any,
    );

    // render image from chartjs config as png
    new Chart(CHARTJS_NODE_CANVAS as unknown as CanvasRenderingContext2D, config);

    // crete local img file
    const fileName = `${guildId}.png`;
    const imgPath = path.join(path.resolve(), fileName);
    writeFileSync(fileName, GLOBAL_CANVAS.toBuffer("image/png"));

    log(`Created guild member count ${guildName}`);

    // return chart data
    return {
      // link,
      fileName,
      imgPath,
      thirtyDaysCount,
      sevedDaysCount,
      oneDayCount,
      lookback,
    };
  }
}
