import { userJailedEmbed } from "@/core/embeds/user-jailed.embed";
import { ModLogService } from "@/core/services/moderation/modlog.service";
import { RolesService } from "@/core/services/roles/roles.service";
import { ThreadService } from "@/core/services/threads/thread.service";
import { RecentMessagesService } from "@/core/services/messages/recent-messages.service";
import { db } from "@/lib/db";
import { member, memberGuild, memberRole } from "@/lib/db-schema";
import { and, eq } from "drizzle-orm";
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
  RESTJSONErrorCodes,
  TextChannel,
  ThreadChannel,
  User,
} from "discord.js";
import { error, log } from "node:console";

const CHANNEL_CONCURRENCY = 3;
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

export interface SweepResult {
  deleted: number;
  unreadable: string[];
}

const isMissingAccess = (err: unknown) =>
  err instanceof DiscordAPIError &&
  (err.code === RESTJSONErrorCodes.MissingAccess ||
    err.code === RESTJSONErrorCodes.MissingPermissions);

async function deleteEach(channel: GuildTextBasedChannel, ids: string[]) {
  let deleted = 0;
  for (const id of ids) {
    try {
      await channel.messages.delete(id);
      deleted++;
    } catch (err) {
      if (
        err instanceof DiscordAPIError &&
        err.code === RESTJSONErrorCodes.UnknownMessage
      )
        continue;
      if (!isMissingAccess(err)) error(err);
      return { deleted, reachable: false };
    }
  }
  return { deleted, reachable: true };
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
   * Delete the member's messages from the last 14 days: what RecentMessages
   * recorded, then with thorough a crawl of every channel for anything it missed.
   * Returns null when a sweep was already running.
   */
  static async deleteUserMessages(
    params: DeleteUserMessagesParams,
    thorough = false,
  ): Promise<SweepResult | null> {
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
      log(
        `[DeleteUserMessages] Starting message deletion for user ${params.memberId} in guild ${params.guild.name} (thorough: ${thorough})`,
      );
      const unreadable = new Set<string>();
      let deleted = await this.deleteRecorded(params, unreadable);
      if (thorough) deleted += await this.runDeletion(params, unreadable);
      log(
        `[DeleteUserMessages] Finished. Deleted ${deleted} messages total for user ${params.memberId}` +
          (unreadable.size ? `, unreadable: ${[...unreadable].join(", ")}` : ""),
      );
      return { deleted, unreadable: [...unreadable] };
    } finally {
      this.activeSweeps.delete(sweepKey);
    }
  }

  private static activeSweeps = new Set<string>();

  static isSweeping(guildId: string, memberId: string) {
    return this.activeSweeps.has(`${guildId}:${memberId}`);
  }

  private static async deleteRecorded(
    params: DeleteUserMessagesParams,
    unreadable: Set<string>,
  ) {
    const channels = await RecentMessagesService.byChannel(
      params.guild.id,
      params.memberId,
    );
    let deleted = 0;

    for (const [channelId, ids] of channels) {
      const channel =
        params.guild.channels.cache.get(channelId) ??
        (await params.guild.channels.fetch(channelId).catch(() => null));
      if (channel && !channel.isTextBased()) continue;

      // Same as the crawl: a thread the member started goes with all its replies.
      if (channel?.isThread() && channel.ownerId === params.memberId) {
        const removed = await channel.delete().then(
          () => true,
          (err) => {
            if (isMissingAccess(err)) unreadable.add(`#${channel.name}`);
            else error(err);
            return false;
          },
        );
        if (removed) {
          await ThreadService.deleteThread(channel.id);
          await RecentMessagesService.forget(ids);
        }
        continue;
      }

      let reachable = true;
      for (let i = 0; channel && reachable && i < ids.length; i += 100) {
        const batch = ids.slice(i, i + 100);
        try {
          deleted += (await channel.bulkDelete(batch, true)).size;
        } catch (err) {
          if (isMissingAccess(err)) {
            unreadable.add(`#${channel.name}`);
            reachable = false;
            break;
          }
          // A message already gone can fail the whole batch, so retry it one by one.
          const each = await deleteEach(channel, batch);
          deleted += each.deleted;
          if (!each.reachable) {
            unreadable.add(`#${channel.name}`);
            reachable = false;
          }
        }
      }
      // Kept while unreadable so a retry after a permission fix still finds them.
      if (reachable) await RecentMessagesService.forget(ids);
    }

    log(
      `[DeleteUserMessages] Deleted ${deleted} recorded messages across ${channels.size} channels`,
    );
    return deleted;
  }

  private static async runDeletion(
    params: DeleteUserMessagesParams,
    unreadable: Set<string>,
  ) {
    let totalDeleted = 0;
    const cutoff = Date.now() - MAX_DELETE_AGE_MS;

    const deleteMessages = async (channel: GuildTextBasedChannel) => {
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
        if (isMissingAccess(err)) {
          unreadable.add(`#${channel.name}`);
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

    const channelTasks: (() => Promise<void>)[] = [];

    for (const channel of params.guild.channels.cache.values()) {
      if (channel.type === ChannelType.GuildForum) {
        channelTasks.push(async () => {
          const threads = await (channel as ForumChannel).threads
            .fetchActive()
            .catch(error);
          if (threads) {
            for (const thread of threads.threads.values()) {
              await processThread(thread);
            }
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
    log(`[DeleteUserMessages] Crawl deleted ${totalDeleted} more messages`);
    return totalDeleted;
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
