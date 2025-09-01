import dayjs from "dayjs";
import {
  ChannelType,
  Guild,
  Message,
  NewsChannel,
  TextChannel,
  ThreadChannel,
  User,
} from "discord.js";
import { prisma } from "../../prisma";
import { JAIL } from "../constants";
import { RolesService } from "../roles/roles.service";

type MessageChannel = TextChannel | NewsChannel | ThreadChannel;

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
  // Handle jailing user
  if (jail) {
    const jailRoleId = RolesService.getGuildStatusRoles(guild)[JAIL]?.id;
    if (!jailRoleId) return;

    await prisma.$transaction(async (tx) => {
      // Ensure member exists
      await tx.member.upsert({
        where: { memberId },
        create: { memberId, username: user?.username || "Unknown User" },
        update: {},
      });

      // Replace all roles with jail role
      await tx.memberRole.deleteMany({
        where: { memberId, guildId: guild.id },
      });
      await tx.memberRole.create({
        data: { roleId: jailRoleId, memberId, guildId: guild.id, name: JAIL },
      });
    });

    // Add Discord role if user is on server
    const member = guild.members.cache.get(user?.id || memberId);
    const role = guild.roles.cache.get(jailRoleId);
    if (member && role?.editable) {
      await member.roles.add(jailRoleId).catch(console.error);
    }
  }

  // Delete messages from the last N days
  const cutoffDate = dayjs().subtract(days, "day");
  const messageChannelTypes = [
    ChannelType.GuildText,
    ChannelType.GuildAnnouncement,
    ChannelType.PublicThread,
    ChannelType.PrivateThread,
  ];

  for (const channel of guild.channels.cache.values()) {
    if (!messageChannelTypes.includes(channel.type)) continue;

    const messageChannel = channel as MessageChannel;

    try {
      // Check if this is a thread and user is the owner
      if (channel.isThread()) {
        const thread = channel as ThreadChannel;
        if (thread.ownerId === memberId) {
          // Delete the entire thread if user is the owner
          await thread.delete().catch(console.error);
          continue; // Skip message deletion since thread is deleted
        }
      }

      // Delete individual messages
      const messages = await messageChannel.messages.fetch({ limit: 100 });
      const userMessages = messages.filter(
        (m: Message) =>
          m.author.id === memberId && dayjs(m.createdAt).isAfter(cutoffDate)
      );

      await Promise.all(
        userMessages.map((m: Message) => m.delete().catch(console.error))
      );
    } catch (error) {
      console.error(`Error processing channel ${channel.id}:`, error);
    }
  }
};
