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
  Guild,
  TextChannel,
  User,
} from "discord.js";
import { Routes } from "discord-api-types/v10";
import type { APIMessageSearchResult, APIMessage } from "discord-api-types/v10";
import { error, log } from "node:console";

const SEARCH_LIMIT = 25;
const BULK_DELETE_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

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

    await this.deleteMessagesViaSearch(params);
  }

  /**
   * Uses the guild message search API to find and delete all messages by a user,
   * instead of iterating every channel individually.
   */
  private static async deleteMessagesViaSearch(params: DeleteUserMessagesParams) {
    const rest = params.guild.client.rest;
    const deletedThreadIds = new Set<string>();
    let offset = 0;

    for (;;) {
      let result: APIMessageSearchResult;
      try {
        result = await rest.get(
          Routes.guildMessagesSearch(params.guild.id),
          { query: new URLSearchParams({ author_id: params.memberId, limit: String(SEARCH_LIMIT), offset: String(offset) }) },
        ) as APIMessageSearchResult;
      } catch (err) {
        // 202 means search index not ready yet, retry once after delay
        if (err instanceof DiscordAPIError && err.status === 202) {
          log(`[DeleteUserMessages] Search index not ready, retrying after delay`);
          await new Promise((r) => setTimeout(r, 3000));
          try {
            result = await rest.get(
              Routes.guildMessagesSearch(params.guild.id),
              { query: new URLSearchParams({ author_id: params.memberId, limit: String(SEARCH_LIMIT), offset: String(offset) }) },
            ) as APIMessageSearchResult;
          } catch {
            log(`[DeleteUserMessages] Search index still not ready, aborting`);
            return;
          }
        } else {
          error(`[DeleteUserMessages] Search API error:`, err);
          return;
        }
      }

      const messages = result.messages.flat();
      if (messages.length === 0) break;

      // Delete threads owned by this user
      const threadIds = (result.threads || [])
        .filter((t) => t.owner_id === params.memberId)
        .map((t) => t.id);

      for (const threadId of threadIds) {
        if (deletedThreadIds.has(threadId)) continue;
        try {
          const thread = params.guild.channels.cache.get(threadId);
          if (thread) await thread.delete();
          else await rest.delete(Routes.channel(threadId));
          deletedThreadIds.add(threadId);
          await ThreadService.deleteThread(threadId);
        } catch (err) {
          if (err instanceof DiscordAPIError && err.code === 10003) {
            await ThreadService.deleteThread(threadId);
          } else {
            error(`[DeleteUserMessages] Failed to delete thread ${threadId}:`, err);
          }
        }
      }

      // Group remaining messages by channel for bulk deletion
      const messagesByChannel = new Map<string, APIMessage[]>();
      for (const msg of messages) {
        // Skip messages in threads we already deleted
        if (deletedThreadIds.has(msg.channel_id)) continue;
        const existing = messagesByChannel.get(msg.channel_id) || [];
        existing.push(msg);
        messagesByChannel.set(msg.channel_id, existing);
      }

      for (const [channelId, channelMessages] of messagesByChannel) {
        try {
          const now = Date.now();
          const recentIds = channelMessages
            .filter((m) => now - new Date(m.timestamp).getTime() < BULK_DELETE_AGE_MS)
            .map((m) => m.id);
          const oldIds = channelMessages
            .filter((m) => now - new Date(m.timestamp).getTime() >= BULK_DELETE_AGE_MS)
            .map((m) => m.id);

          // Bulk delete recent messages (2+ required for bulk delete endpoint)
          if (recentIds.length >= 2) {
            const channel = params.guild.channels.cache.get(channelId);
            if (channel && "bulkDelete" in channel) {
              await (channel as TextChannel).bulkDelete(recentIds, true).catch(error);
            }
          } else if (recentIds.length === 1) {
            oldIds.push(recentIds[0]);
          }

          // Delete old messages individually
          for (const msgId of oldIds) {
            await rest.delete(Routes.channelMessage(channelId, msgId)).catch(error);
          }
        } catch (err) {
          if (err instanceof DiscordAPIError && err.code === 10003) {
            log(`[DeleteUserMessages] Channel ${channelId} no longer exists, cleaning up`);
          } else {
            error(`[DeleteUserMessages] Error deleting messages in ${channelId}:`, err);
          }
        }
      }

      // If we got fewer results than the limit, we've reached the end
      if (messages.length < SEARCH_LIMIT) break;

      // Don't increase offset since we're deleting messages, which shifts results.
      // But if deletion fails for some, we'd loop forever, so bump offset by how
      // many messages were in threads we skipped (not deleted individually).
      const skipped = messages.filter((m) => deletedThreadIds.has(m.channel_id)).length;
      offset += skipped;
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
