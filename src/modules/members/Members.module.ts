import { Prisma } from "@prisma/client";
import {
  APIEmbed,
  GuildMember,
  PartialGuildMember,
  TextChannel,
} from "discord.js";
import { prisma } from "../../prisma.js";
import {
  JOIN_EVENTS_CHANNEL,
  MEMBERS_COUNT_CHANNEL,
  simpleEmbedExample,
} from "../constants.js";

export class MembersModule {
  static async upsertDbMember(
    member: GuildMember | PartialGuildMember,
    status: "join" | "leave",
  ) {
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
        await member.roles.add(role.roleId);
      }

    // return user
    return dbMember;
  }

  static async logJoinLeaveEvents(
    member: GuildMember,
    event: "join" | "leave",
  ) {
    try {
      // get voice channel by name
      const joinEventsChannel = member.guild.channels.cache.find(
        ({ name }) => name === JOIN_EVENTS_CHANNEL,
      );

      // check if voice channel exists and it is voice channel
      if (!joinEventsChannel || !joinEventsChannel.isTextBased()) return;

      const userServerName = member?.user.toString();
      const userGlobalName = member?.user.username;

      // copy paste embed so it doesnt get overwritten
      const joinEmbed = JSON.parse(
        JSON.stringify(simpleEmbedExample),
      ) as APIEmbed;

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
    const memberCount = member.guild.members.cache.filter(
      (member) => !member.user.bot,
    ).size;

    // set channel name as member count
    try {
      await memberCountChannel.setName(
        `${MEMBERS_COUNT_CHANNEL} ${memberCount}`,
      );
    } catch (_) {}
  }
}
