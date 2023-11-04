import type { Prisma } from "@prisma/client";
import dayjs from "dayjs";
import { ChannelType, Guild, User } from "discord.js";
import { prisma } from "../../prisma.js";
import { RolesService } from "../roles/Roles.service.js";
import { JAIL } from "../constants.js";

export const deleteUserMessages = async ({
  guild,
  user,
  memberId,
  days,
  jail,
}: {
  guild: Guild;
  user: User | null;
  memberId: string;
  days: number;
  jail: string | number | boolean;
}) => {
  if (jail) {
    //get status roles
    const guildStatusRoles = RolesService.getGuildStatusRoles(guild);

    // delete all roles
    await prisma.memberRole.deleteMany({
      where: {
        memberId,
        guildId: guild.id,
      },
    });

    // role input
    const memberRole: Prisma.MemberRoleUncheckedCreateInput = {
      roleId: guildStatusRoles[JAIL]!.id,
      memberId,
      guildId: guild.id,
    };

    // create mute role
    await prisma.memberRole.upsert({
      where: {
        member_role: {
          memberId: memberRole.memberId,
          roleId: memberRole.roleId,
        },
      },
      create: memberRole,
      update: memberRole,
    });

    // if user still on server add mute role
    user && guild.members.cache.get(user.id)!.roles.add(memberRole.roleId);
  }

  // create date before which messages should be deleted
  const daysTimestamp = dayjs().subtract(Number(days), "day");

  // get all channels
  const channels = guild?.channels.cache;

  // if no channels exist, return
  if (!channels) return;

  // deferReply if it takes longer then usual

  // loop over all channels
  for (let channel of channels.values()) {
    try {
      // if channel is not a text channel, continue
      if (
        channel.type !== ChannelType.PublicThread &&
        channel.type !== ChannelType.PrivateThread &&
        channel.type !== ChannelType.GuildAnnouncement &&
        channel.type !== ChannelType.GuildForum &&
        channel.type !== ChannelType.GuildText &&
        channel.type !== ChannelType.GuildVoice &&
        channel.type !== ChannelType.GuildStageVoice
      )
        continue;

      //cache needs to be cleared
      channel.messages.cache.clear();
      await channel.messages.fetch({ limit: 100 });
      // create message array
      const messages = channel.messages.cache.values();

      // loop over all messages
      for (let message of messages) {
        // check if message was sent by user and if it was sent before daysTimestamp
        if (message.author.id === memberId && 0 < dayjs(message.createdAt).diff(daysTimestamp, "minutes"))
          await message.delete();
      }
    } catch (_) {}
  }
};
