import {
  ChannelType,
  EmbedBuilder,
  ForumChannel,
  Guild,
  NewsChannel,
  TextChannel,
  ThreadChannel,
  User,
} from "discord.js";
import { error } from "node:console";
import { prisma } from "@/prisma";
import { BOT_ICON, JAIL, RED_COLOR } from "@/shared/config";
import { RolesService } from "@/core/services/roles/roles.service";

type MessageChannel = TextChannel | NewsChannel | ThreadChannel;

const sendJailNotification = async (params: {
  guild: Guild;
  user: User | null;
  memberId: string;
  reason?: string;
}) => {
  // Find jail channel (channel with "jail" in name)
  const jailChannel = params.guild.channels.cache.find(
    (ch) =>
      ch.type === ChannelType.GuildText &&
      ch.name.toLowerCase().includes("jail"),
  ) as TextChannel | undefined;

  if (!jailChannel) return;

  // Get user info from DB for fallback
  const dbMember = await prisma.member.findUnique({
    where: { memberId: params.memberId },
    include: {
      guilds: {
        where: { guildId: params.guild.id },
        take: 1,
      },
    },
  });

  const displayName =
    dbMember?.guilds[0]?.displayName ||
    dbMember?.globalName ||
    dbMember?.username ||
    "Unknown";
  const username = dbMember?.username || "Unknown";

  const embed = new EmbedBuilder()
    .setColor(RED_COLOR ?? 0xff0000)
    .setTitle("User Jailed")
    .setDescription(
      [
        `**User:** <@${params.memberId}>`,
        `**Username:** ${displayName} (${username})`,
        `**Member ID:** ${params.memberId}`,
        `**Reason:** ${params.reason || "No reason provided"}`,
      ].join("\n"),
    )
    .setTimestamp()
    .setFooter({ text: "Jail System", iconURL: BOT_ICON });

  await jailChannel.send({ embeds: [embed] }).catch(error);
};

export const deleteUserMessages = async (params: {
  guild: Guild;
  user: User | null;
  memberId: string;
  jail: string | number | boolean;
  reason?: string;
}) => {
  if (params.jail) {
    const jailRoleId = RolesService.getGuildStatusRoles(params.guild)[JAIL]?.id;
    if (!jailRoleId) return;

    // Check if user already has jail role - skip notification if they do
    const member = params.guild.members.cache.get(
      params.user?.id || params.memberId,
    );
    const alreadyJailed = member?.roles.cache.has(jailRoleId);

    await prisma.$transaction(async (tx) => {
      await tx.member.upsert({
        where: { memberId: params.memberId },
        create: {
          memberId: params.memberId,
          username: params.user?.username || "Unknown User",
        },
        update: {},
      });
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

    const role = params.guild.roles.cache.get(jailRoleId);
    if (member && role?.editable)
      await member.roles.add(jailRoleId).catch(error);

    // Send notification to jail channel only if user wasn't already jailed
    if (!alreadyJailed) {
      await sendJailNotification(params);
    }
  }

  const deleteMessages = async (channel: MessageChannel) => {
    const messages = await channel.messages.fetch({ limit: 100 });
    const userMessages = messages.filter(
      (m) => m.author.id === params.memberId,
    );
    if (userMessages.size > 0)
      await channel.bulkDelete(userMessages).catch(error);
  };

  const processThread = async (thread: ThreadChannel) => {
    if (thread.ownerId === params.memberId)
      return void (await thread.delete().catch(error));
    await deleteMessages(thread);
  };

  for (const channel of params.guild.channels.cache.values()) {
    if (channel.type === ChannelType.GuildForum) {
      const threads = await (channel as ForumChannel).threads
        .fetchActive()
        .catch(error);
      if (threads) {
        for (const thread of threads.threads.values()) {
          await processThread(thread).catch(error);
        }
      }
    } else if (
      [
        ChannelType.GuildText,
        ChannelType.GuildAnnouncement,
        ChannelType.GuildVoice,
        ChannelType.GuildStageVoice,
        ChannelType.GuildMedia,
      ].includes(channel.type)
    ) {
      await deleteMessages(channel as MessageChannel).catch(error);
    } else if (
      [
        ChannelType.PublicThread,
        ChannelType.PrivateThread,
        ChannelType.AnnouncementThread,
      ].includes(channel.type)
    ) {
      await processThread(channel as ThreadChannel).catch(error);
    }
  }
};
