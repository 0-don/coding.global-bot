import dayjs from "dayjs";
import {
  ChannelType,
  ForumChannel,
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

export const deleteUserMessages = async (params: {
  guild: Guild;
  user: User | null;
  memberId: string;
  days: number;
  jail: string | number | boolean;
}) => {
  // Handle jailing user
  if (params.jail) {
    const jailRoleId = RolesService.getGuildStatusRoles(params.guild)[JAIL]?.id;
    if (!jailRoleId) return;

    await prisma.$transaction(async (tx) => {
      // Ensure member exists
      await tx.member.upsert({
        where: { memberId: params.memberId },
        create: {
          memberId: params.memberId,
          username: params.user?.username || "Unknown User",
        },
        update: {},
      });

      // Replace all roles with jail role
      await tx.memberRole.deleteMany({
        where: { memberId: params.memberId, guildId: params.guild.id },
      });
      await tx.memberRole.create({
        data: {
          roleId: jailRoleId,
          memberId: params.memberId,
          guildId: params.guild.id,
          name: JAIL,
        },
      });
    });

    // Add Discord role if user is on server
    const member = params.guild.members.cache.get(
      params.user?.id || params.memberId,
    );
    const role = params.guild.roles.cache.get(jailRoleId);
    if (member && role?.editable) {
      await member.roles.add(jailRoleId).catch(console.error);
    }
  }

  // Delete messages from the last N days
  const cutoffDate = dayjs().subtract(params.days, "day");
  const messageChannelTypes = [
    ChannelType.GuildText,
    ChannelType.GuildAnnouncement,
    ChannelType.PublicThread,
    ChannelType.PrivateThread,
  ];

  const forumChannelTypes = [ChannelType.GuildForum];

  const processThread = async (thread: ThreadChannel) => {
    try {
      // Delete entire thread if user is the owner
      if (thread.ownerId === params.memberId) {
        await thread.delete().catch(console.error);
        return;
      }

      // Delete individual messages
      const messages = await thread.messages.fetch({ limit: 100 });
      const userMessages = messages.filter(
        (m: Message) =>
          m.author.id === params.memberId &&
          dayjs(m.createdAt).isAfter(cutoffDate),
      );

      await Promise.all(
        userMessages.map((m: Message) =>
          m.delete().catch((error) => {
            if (error?.code === 10008) return;
            console.error(`Failed to delete message ${m.id}:`, error);
          }),
        ),
      );
    } catch (error) {
      console.error(`Error processing thread ${thread.id}:`, error);
    }
  };

  const processMessageChannel = async (channel: MessageChannel) => {
    try {
      const messages = await channel.messages.fetch({ limit: 100 });
      const userMessages = messages.filter(
        (m: Message) =>
          m.author.id === params.memberId &&
          dayjs(m.createdAt).isAfter(cutoffDate),
      );

      await Promise.all(
        userMessages.map((m: Message) =>
          m.delete().catch((error) => {
            if (error?.code === 10008) return;
            console.error(`Failed to delete message ${m.id}:`, error);
          }),
        ),
      );
    } catch (error) {
      console.error(`Error processing channel ${channel.id}:`, error);
    }
  };

  for (const channel of params.guild.channels.cache.values()) {
    // Handle forum channels - fetch their threads
    if (forumChannelTypes.includes(channel.type)) {
      const forumChannel = channel as ForumChannel;
      try {
        const activeThreads = await forumChannel.threads.fetchActive();
        const archivedThreads = await forumChannel.threads.fetchArchived();

        for (const thread of activeThreads.threads.values()) {
          await processThread(thread);
        }
        for (const thread of archivedThreads.threads.values()) {
          await processThread(thread);
        }
      } catch (error) {
        console.error(`Error fetching forum threads ${channel.id}:`, error);
      }
      continue;
    }

    if (!messageChannelTypes.includes(channel.type)) continue;

    // Handle threads (from text channels)
    if (channel.isThread()) {
      await processThread(channel as ThreadChannel);
      continue;
    }

    // Handle regular text/announcement channels
    await processMessageChannel(channel as MessageChannel);
  }
};
