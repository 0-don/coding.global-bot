import type { Prisma } from "@prisma/client";
import dayjs from "dayjs";
import { ChannelType, Guild, User } from "discord.js";
import { prisma } from "../../prisma";
import { JAIL } from "../constants";
import { RolesService } from "../roles/roles.service";

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
    // Get status roles
    const guildStatusRoles = RolesService.getGuildStatusRoles(guild);

    // Use transaction to ensure consistency
    await prisma.$transaction(async (tx) => {
      // Ensure member exists in database first
      await tx.member.upsert({
        where: { memberId },
        create: {
          memberId,
          username: user?.username || "Unknown User",
        },
        update: {},
      });

      // Delete all existing roles for this member
      await tx.memberRole.deleteMany({
        where: {
          memberId,
          guildId: guild.id,
        },
      });

      // Create jail role entry
      const memberRole: Prisma.MemberRoleUncheckedCreateInput = {
        roleId: guildStatusRoles[JAIL]!.id,
        memberId,
        guildId: guild.id,
        name: JAIL,
      };

      // Create the jail role in database
      await tx.memberRole.upsert({
        where: {
          member_role: {
            memberId: memberRole.memberId,
            roleId: memberRole.roleId,
          },
        },
        create: memberRole,
        update: memberRole,
      });
    });

    // If user is still on server, add jail role to Discord
    const role = guild.roles.cache.get(guildStatusRoles[JAIL]!.id);
    if (user && role) {
      if (!role.editable) return;
      const member = guild.members.cache.get(user.id);
      if (member) {
        try {
          await member.roles.add(guildStatusRoles[JAIL]!.id); // Fixed: use the role ID directly
        } catch (error) {
          console.error(`Failed to add jail role to ${user.username}:`, error);
        }
      }
    }
  }

  // Create date before which messages should be deleted
  const daysTimestamp = dayjs().subtract(Number(days), "day");

  // Get all channels
  const channels = guild?.channels.cache;

  // If no channels exist, return
  if (!channels) return;

  // Loop over all channels
  for (let channel of channels.values()) {
    try {
      // If channel is not a text channel, continue
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

      // Skip channels that don't have messages property
      if (!("messages" in channel)) continue;

      // Cache needs to be cleared
      channel.messages.cache.clear();
      await channel.messages.fetch({ limit: 100 });

      // Create message array
      const messages = channel.messages.cache.values();

      // Loop over all messages
      for (let message of messages) {
        // Check if message was sent by user and if it was sent after daysTimestamp
        if (
          message.author.id === memberId &&
          dayjs(message.createdAt).isAfter(daysTimestamp)
        ) {
          try {
            await message.delete();
          } catch (error) {
            console.error(`Failed to delete message ${message.id}:`, error);
          }
        }
      }
    } catch (error) {
      console.error(`Error processing channel ${channel.id}:`, error);
    }
  }
};
