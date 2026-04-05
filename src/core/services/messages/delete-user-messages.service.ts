import { userJailedEmbed } from "@/core/embeds/user-jailed.embed";
import { RolesService } from "@/core/services/roles/roles.service";
import { ThreadService } from "@/core/services/threads/thread.service";
import { db } from "@/lib/db";
import { member, memberRole } from "@/lib/db-schema";
import { and, eq } from "drizzle-orm";
import { JAIL } from "@/shared/config/roles";
import type { DeleteUserMessagesParams } from "@/types";
import {
  ChannelType,
  DiscordAPIError,
  ForumChannel,
  Guild,
  GuildTextBasedChannel,
  TextChannel,
  ThreadChannel,
  User,
} from "discord.js";
import { error, log } from "node:console";

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

    log(`[DeleteUserMessages] Starting message deletion for user ${params.memberId} in guild ${params.guild.name}`);
    let totalDeleted = 0;

    const deleteMessages = async (channel: GuildTextBasedChannel) => {
      try {
        let deleted = 0;
        let lastMessageId: string | undefined;

        // Paginate through all messages in the channel
        for (;;) {
          const messages = await channel.messages.fetch({
            limit: 100,
            ...(lastMessageId ? { before: lastMessageId } : {}),
          });
          if (messages.size === 0) break;

          lastMessageId = messages.last()!.id;
          const userMessages = messages.filter(
            (m) => m.author.id === params.memberId,
          );

          if (userMessages.size > 0) {
            // bulkDelete handles the 14-day limit internally with filterOld=true
            const result = await channel.bulkDelete(userMessages, true);
            deleted += result.size;

            // Individually delete messages older than 14 days that bulkDelete skipped
            const bulkDeletedIds = new Set(result.keys());
            const remaining = userMessages.filter((m) => !bulkDeletedIds.has(m.id));
            for (const msg of remaining.values()) {
              await msg.delete().catch(error);
              deleted++;
            }
          }

          if (messages.size < 100) break;
        }

        if (deleted > 0) {
          log(`[DeleteUserMessages] Deleted ${deleted} messages in #${channel.name} (${channel.id})`);
          totalDeleted += deleted;
        }
      } catch (err) {
        if (err instanceof DiscordAPIError && err.code === 10003) {
          log(`[DeleteUserMessages] Channel ${channel.id} no longer exists, cleaning up DB records`);
          if (channel.isThread()) await ThreadService.deleteThread(channel.id);
          return;
        }
        error(err);
      }
    };

    const processThread = async (thread: ThreadChannel) => {
      try {
        if (thread.ownerId === params.memberId) {
          log(`[DeleteUserMessages] Deleting thread owned by user: #${thread.name} (${thread.id})`);
          await thread.delete();
          return;
        }
        await deleteMessages(thread as GuildTextBasedChannel);
      } catch (err) {
        if (err instanceof DiscordAPIError && err.code === 10003) {
          log(`[DeleteUserMessages] Thread ${thread.id} no longer exists, cleaning up DB records`);
          await ThreadService.deleteThread(thread.id);
          return;
        }
        error(err);
      }
    };

    const channelPromises: Promise<void>[] = [];

    for (const channel of params.guild.channels.cache.values()) {
      if (channel.type === ChannelType.GuildForum) {
        channelPromises.push((async () => {
          const threads = await (channel as ForumChannel).threads
            .fetchActive()
            .catch(error);
          if (threads) {
            await Promise.allSettled(
              threads.threads.map((thread) => processThread(thread)),
            );
          }
        })());
      } else if (
        [
          ChannelType.GuildText,
          ChannelType.GuildAnnouncement,
          ChannelType.GuildVoice,
          ChannelType.GuildStageVoice,
          ChannelType.GuildMedia,
        ].includes(channel.type)
      ) {
        channelPromises.push(deleteMessages(channel as GuildTextBasedChannel));
      } else if (
        [
          ChannelType.PublicThread,
          ChannelType.PrivateThread,
          ChannelType.AnnouncementThread,
        ].includes(channel.type)
      ) {
        channelPromises.push(processThread(channel as ThreadChannel));
      }
    }

    await Promise.allSettled(channelPromises);
    log(`[DeleteUserMessages] Finished. Deleted ${totalDeleted} messages total for user ${params.memberId}`);
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
