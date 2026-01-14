import { userJailedEmbed } from "@/core/embeds/user-jailed.embed";
import { RolesService } from "@/core/services/roles/roles.service";
import { prisma } from "@/prisma";
import { JAIL } from "@/shared/config/roles";
import type { DeleteUserMessagesParams } from "@/types";
import {
  ChannelType,
  ForumChannel,
  Guild,
  GuildTextBasedChannel,
  TextChannel,
  ThreadChannel,
  User,
} from "discord.js";
import { error } from "node:console";

export class DeleteUserMessagesService {
  static async deleteUserMessages(params: DeleteUserMessagesParams) {
    if (params.jail) {
      const jailRoleId = RolesService.getGuildStatusRoles(params.guild)[JAIL]
        ?.id;
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
        await this.sendJailNotification(params);
      }
    }

    const deleteMessages = async (channel: GuildTextBasedChannel) => {
      const messages = await channel.messages.fetch({ limit: 100 });
      const userMessages = messages.filter(
        (m) => m.author.id === params.memberId,
      );
      if (userMessages.size > 0)
        await channel.bulkDelete(userMessages, true).catch(error);
    };

    const processThread = async (thread: ThreadChannel) => {
      if (thread.ownerId === params.memberId)
        return void (await thread.delete().catch(error));
      await deleteMessages(thread as GuildTextBasedChannel);
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
        await deleteMessages(channel as GuildTextBasedChannel).catch(error);
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
  }

  private static async sendJailNotification(params: {
    guild: Guild;
    user: User | null;
    memberId: string;
    reason?: string;
  }) {
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

    const embed = userJailedEmbed({
      memberId: params.memberId,
      displayName,
      username,
      reason: params.reason,
    });

    await jailChannel.send({ embeds: [embed] }).catch(error);
  }
}
