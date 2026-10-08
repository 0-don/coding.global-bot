import { userJailedEmbed } from "@/core/embeds/user-jailed.embed";
import { ModLogService } from "@/core/services/moderation/modlog.service";
import { RolesService } from "@/core/services/roles/roles.service";
import { ThreadService } from "@/core/services/threads/thread.service";
import { db } from "@/lib/db";
import {
  member,
  memberGuild,
  memberMessages,
  memberRole,
} from "@/lib/db-schema";
import { and, eq, gte } from "drizzle-orm";
import { JAIL } from "@/shared/config/roles";
import { TEMPLATE_VALIDATION_CHANNELS } from "@/shared/config/channels";
import { ConfigValidator } from "@/shared/config/validator";
import type { DeleteUserMessagesParams } from "@/types";
import {
  ChannelType,
  DiscordAPIError,
  ForumChannel,
  Guild,
  GuildTextBasedChannel,
  PermissionFlagsBits,
  SnowflakeUtil,
  TextChannel,
  ThreadChannel,
  User,
} from "discord.js";
import { error, log } from "node:console";

// discord.js queues per route bucket, and bulk delete buckets per channel
const CHANNEL_CONCURRENCY = 10;
const MAX_DELETE_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = [];
  let index = 0;

  async function runNext(): Promise<void> {
    while (index < tasks.length) {
      const currentIndex = index++;
      try {
        const value = await tasks[currentIndex]();
        results[currentIndex] = { status: "fulfilled", value };
      } catch (reason) {
        results[currentIndex] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, () =>
      runNext(),
    ),
  );
  return results;
}

export class DeleteUserMessagesService {
  /**
   * Jail user and start message deletion in background.
   * Returns as soon as the jail is applied.
   */
  static async jailAndDeleteMessages(params: DeleteUserMessagesParams) {
    await this.jailUser(params);
    this.deleteUserMessages(params).catch(error);
  }

  /**
   * Apply jail role, update DB, send notification. Fast operation (~2s).
   */
  static async jailUser(params: DeleteUserMessagesParams) {
    const jailRoleId = RolesService.getGuildStatusRoles(params.guild)[JAIL]
      ?.id;
    if (!jailRoleId) return;

    const memberId = params.user?.id || params.memberId;
    const discordMember =
      params.guild.members.cache.get(memberId) ||
      (await params.guild.members.fetch(memberId).catch(() => null));
    const alreadyJailed = discordMember?.roles.cache.has(jailRoleId);

    await db.transaction(async (tx) => {
      await tx
        .insert(member)
        .values({
          memberId: params.memberId,
          username: params.user?.username || "Unknown User",
        })
        .onConflictDoNothing();

      await tx.delete(memberRole).where(
        and(
          eq(memberRole.memberId, params.memberId),
          eq(memberRole.guildId, params.guild.id),
        ),
      );

      await tx.insert(memberRole).values({
        roleId: jailRoleId,
        memberId: params.memberId,
        guildId: params.guild.id,
        name: JAIL,
      });
    });

    const role = params.guild.roles.cache.get(jailRoleId);
    if (discordMember && role?.editable)
      await discordMember.roles.add(jailRoleId, params.reason).catch(error);

    if (!alreadyJailed) {
      await this.sendJailNotification(params);
      await ModLogService.record(params.guild, {
        action: "User Jailed",
        targetId: params.memberId,
        moderatorId: params.moderatorId ?? params.guild.client.user.id,
        reason: params.reason,
      });
    }
  }

  /**
   * Delete user messages across all channels. Scoped to last 14 days.
   * Returns how many were deleted, or null when a sweep was already running.
   */
  static async deleteUserMessages(
    params: DeleteUserMessagesParams,
  ): Promise<number | null> {
    // A spammer's messages arrive faster than one sweep of 275 channels takes, and
    // every detector that catches them calls this, so without a guard the same user
    // gets several concurrent sweeps that each re-scan what the others deleted.
    const sweepKey = `${params.guild.id}:${params.memberId}`;
    if (this.activeSweeps.has(sweepKey)) {
      log(
        `[DeleteUserMessages] Sweep already running for user ${params.memberId}, skipping`,
      );
      return null;
    }
    this.activeSweeps.add(sweepKey);

    try {
      return await this.runDeletion(params);
    } finally {
      this.activeSweeps.delete(sweepKey);
    }
  }

  private static activeSweeps = new Set<string>();

  private static async runDeletion(params: DeleteUserMessagesParams) {
    log(
      `[DeleteUserMessages] Starting message deletion for user ${params.memberId} in guild ${params.guild.name}`,
    );
    let totalDeleted = 0;
    const cutoff = Date.now() - MAX_DELETE_AGE_MS;
    const me = params.guild.members.me;

    const deleteMessages = async (channel: GuildTextBasedChannel) => {
      if (
        !channel.lastMessageId ||
        SnowflakeUtil.timestampFrom(channel.lastMessageId) < cutoff
      )
        return;
      // 403s count toward Discord's invalid request limit (10k per 10 min ban)
      const perms = me && channel.permissionsFor(me);
      if (
        !perms?.has([
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageMessages,
        ])
      )
        return;
      try {
        let deleted = 0;
        let lastMessageId: string | undefined;

        for (;;) {
          const messages = await channel.messages.fetch({
            limit: 100,
            ...(lastMessageId ? { before: lastMessageId } : {}),
          });
          if (messages.size === 0) break;

          lastMessageId = messages.last()!.id;

          // Stop if we've gone past the 14-day cutoff
          const oldestMessage = messages.last()!;
          const pastCutoff = oldestMessage.createdTimestamp < cutoff;

          const userMessages = messages.filter(
            (m) =>
              m.author.id === params.memberId &&
              m.createdTimestamp >= cutoff,
          );

          if (userMessages.size > 0) {
            const result = await channel.bulkDelete(userMessages, true);
            deleted += result.size;
          }

          if (messages.size < 100 || pastCutoff) break;
        }

        if (deleted > 0) {
          log(
            `[DeleteUserMessages] Deleted ${deleted} messages in #${channel.name} (${channel.id})`,
          );
          totalDeleted += deleted;
        }
      } catch (err) {
        if (err instanceof DiscordAPIError && err.code === 10003) {
          log(
            `[DeleteUserMessages] Channel ${channel.id} no longer exists, cleaning up DB records`,
          );
          if (channel.isThread())
            await ThreadService.deleteThread(channel.id);
          return;
        }
        error(err);
      }
    };

    const processThread = async (thread: ThreadChannel) => {
      try {
        if (thread.ownerId === params.memberId) {
          log(
            `[DeleteUserMessages] Deleting thread owned by user: #${thread.name} (${thread.id})`,
          );
          await thread.delete();
          return;
        }
        await deleteMessages(thread as GuildTextBasedChannel);
      } catch (err) {
        if (err instanceof DiscordAPIError && err.code === 10003) {
          log(
            `[DeleteUserMessages] Thread ${thread.id} no longer exists, cleaning up DB records`,
          );
          await ThreadService.deleteThread(thread.id);
          return;
        }
        error(err);
      }
    };

    const startChannel = params.startChannelId
      ? params.guild.channels.cache.get(params.startChannelId)
      : undefined;
    if (startChannel?.isThread()) await processThread(startChannel);
    else if (startChannel?.isTextBased()) await deleteMessages(startChannel);

    totalDeleted += await this.deleteKnownMessages(params, cutoff);

    const channelTasks: (() => Promise<void>)[] = [];

    for (const channel of params.guild.channels.cache.values()) {
      if (channel.id === params.startChannelId) continue;
      if (channel.type === ChannelType.GuildForum) {
        channelTasks.push(async () => {
          const threads = await (channel as ForumChannel).threads
            .fetchActive()
            .catch(error);
          if (threads) {
            await runWithConcurrency(
              threads.threads.map((thread) => () => processThread(thread)),
              CHANNEL_CONCURRENCY,
            );
          }
        });
      } else if (
        [
          ChannelType.GuildText,
          ChannelType.GuildAnnouncement,
          ChannelType.GuildVoice,
          ChannelType.GuildStageVoice,
          ChannelType.GuildMedia,
        ].includes(channel.type)
      ) {
        channelTasks.push(() =>
          deleteMessages(channel as GuildTextBasedChannel),
        );
      } else if (
        [
          ChannelType.PublicThread,
          ChannelType.PrivateThread,
          ChannelType.AnnouncementThread,
        ].includes(channel.type)
      ) {
        channelTasks.push(() => processThread(channel as ThreadChannel));
      }
    }

    log(
      `[DeleteUserMessages] Processing ${channelTasks.length} channels (concurrency: ${CHANNEL_CONCURRENCY})`,
    );
    await runWithConcurrency(channelTasks, CHANNEL_CONCURRENCY);
    log(
      `[DeleteUserMessages] Finished. Deleted ${totalDeleted} messages total for user ${params.memberId}`,
    );
    return totalDeleted;
  }

  /**
   * Bulk delete the messages already recorded in the DB, all channels in parallel.
   * Misses opted out users and content-less messages, which the sweep catches.
   */
  private static async deleteKnownMessages(
    params: DeleteUserMessagesParams,
    cutoff: number,
  ) {
    const rows = await db
      .select({
        channelId: memberMessages.channelId,
        messageId: memberMessages.messageId,
      })
      .from(memberMessages)
      .where(
        and(
          eq(memberMessages.memberId, params.memberId),
          eq(memberMessages.guildId, params.guild.id),
          gte(memberMessages.createdAt, new Date(cutoff).toISOString()),
        ),
      );

    const byChannel = new Map<string, string[]>();
    for (const row of rows) {
      const ids = byChannel.get(row.channelId) ?? [];
      ids.push(row.messageId);
      byChannel.set(row.channelId, ids);
    }

    let deleted = 0;
    const tasks = [...byChannel].map(([channelId, ids]) => async () => {
      const channel = params.guild.channels.cache.get(channelId);
      if (!channel?.isTextBased()) return;
      for (let i = 0; i < ids.length; i += 100) {
        const result = await channel.bulkDelete(ids.slice(i, i + 100), true);
        deleted += result.size;
      }
    });
    const results = await runWithConcurrency(tasks, CHANNEL_CONCURRENCY);
    for (const r of results) if (r.status === "rejected") error(r.reason);

    log(
      `[DeleteUserMessages] Fast path deleted ${deleted} of ${rows.length} recorded messages in ${byChannel.size} channels`,
    );
    return deleted;
  }

  private static async sendJailNotification(params: {
    guild: Guild;
    user: User | null;
    memberId: string;
    reason?: string;
    moderatorId?: string;
  }) {
    const jailChannel = params.guild.channels.cache.find(
      (ch) =>
        ch.type === ChannelType.GuildText &&
        ch.name.toLowerCase().includes("jail"),
    ) as TextChannel | undefined;

    const backupChannel = ConfigValidator.isFeatureEnabled(
      "TEMPLATE_VALIDATION_CHANNELS",
    )
      ? (params.guild.channels.cache.find(
          (ch) =>
            ch.type === ChannelType.GuildText &&
            TEMPLATE_VALIDATION_CHANNELS.includes(ch.name),
        ) as TextChannel | undefined)
      : undefined;

    if (!jailChannel && !backupChannel) return;

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
      moderatorId: params.moderatorId,
    });

    const payload = {
      embeds: [embed],
      allowedMentions: { users: [], roles: [] },
    };

    await Promise.all([
      jailChannel?.send(payload).catch(error),
      backupChannel?.send(payload).catch(error),
    ]);
  }
}
