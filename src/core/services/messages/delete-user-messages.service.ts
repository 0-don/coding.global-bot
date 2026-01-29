import { userJailedEmbed } from "@/core/embeds/user-jailed.embed";
import { RolesService } from "@/core/services/roles/roles.service";
import { db } from "@/lib/db";
import { member, memberRole } from "@/lib/db-schema";
import { and, eq, ne } from "drizzle-orm";
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
      const memberId = params.user?.id || params.memberId;
      const discordMember = params.guild.members.cache.get(memberId)
        || await params.guild.members.fetch(memberId).catch(() => null);
      const alreadyJailed = discordMember?.roles.cache.has(jailRoleId);

      await db.transaction(async (tx) => {
        await tx.insert(member)
          .values({
            memberId: params.memberId,
            username: params.user?.username || "Unknown User",
          })
          .onConflictDoNothing();

        await tx.delete(memberRole)
          .where(
            and(
              eq(memberRole.memberId, params.memberId),
              eq(memberRole.guildId, params.guild.id),
            )
          );

        await tx.insert(memberRole)
          .values({
            roleId: jailRoleId,
            memberId: params.memberId,
            guildId: params.guild.id,
            name: JAIL,
          });
      });

      const role = params.guild.roles.cache.get(jailRoleId);
      if (discordMember && role?.editable)
        await discordMember.roles.add(jailRoleId).catch(error);

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
    const dbMember = await db.query.member.findFirst({
      where: eq(member.memberId, params.memberId),
      with: {
        memberGuilds: {
          where: eq(memberGuild.guildId, params.guild.id),
          limit: 1,
        },
      },
    });

    const displayName =
      (dbMember?.memberGuilds as any)?.[0]?.displayName ||
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

// Import needed for the where clause in sendJailNotification
import { memberGuild } from "@/lib/db-schema";
