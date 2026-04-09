import { userJailedEmbed } from "@/core/embeds/user-jailed.embed";
import { RolesService } from "@/core/services/roles/roles.service";
import { ThreadService } from "@/core/services/threads/thread.service";
import { db } from "@/lib/db";
import { member, memberGuild, memberRole } from "@/lib/db-schema";
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
      await discordMember.roles.add(jailRoleId).catch(error);

    if (!alreadyJailed) {
      await this.sendJailNotification(params);
    }
  }

  /**
   * Delete user messages across all channels. Scoped to last 14 days.
   */
  static async deleteUserMessages(params: DeleteUserMessagesParams) {
    log(
      `[DeleteUserMessages] Starting message deletion for user ${params.memberId} in guild ${params.guild.name}`,
    );
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
    log(
      `[DeleteUserMessages] Finished. Deleted ${totalDeleted} messages total for user ${params.memberId}`,
    );
  }

  private static async sendJailNotification(params: {
    guild: Guild;
    user: User | null;
    memberId: string;
    reason?: string;
  }) {
    const jailChannel = params.guild.channels.cache.find(
      (ch) =>
        ch.type === ChannelType.GuildText &&
        ch.name.toLowerCase().includes("jail"),
    ) as TextChannel | undefined;

    if (!jailChannel) return;

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
