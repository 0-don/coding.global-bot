import { userJailedEmbed } from "@/core/embeds/user-jailed.embed";
import { ModLogService } from "@/core/services/moderation/modlog.service";
import { RolesService } from "@/core/services/roles/roles.service";
import { ThreadService } from "@/core/services/threads/thread.service";
import { db } from "@/lib/db";
import { member, memberGuild, memberRole } from "@/lib/db-schema";
import { botLogger } from "@/lib/telemetry";
import { and, eq } from "drizzle-orm";
import { JAIL, MEMBER_ROLES, VERIFIED } from "@/shared/config/roles";
import { TEMPLATE_VALIDATION_CHANNELS } from "@/shared/config/channels";
import { ConfigValidator } from "@/shared/config/validator";
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
   *
   * Reports "already-jailed" when the member already held the jail role, so
   * callers can say so and the mod log does not record the jail twice. The role
   * and DB writes still run in that case: the automod and /delete-user-messages
   * rely on them to repair a jail whose DB row went missing. "no-jail-role" means
   * nothing happened, and callers must not report a jail.
   */
  static async jailUser(
    params: DeleteUserMessagesParams,
  ): Promise<{ status: "jailed" | "already-jailed" | "no-jail-role" }> {
    const jailRoleId = RolesService.getGuildStatusRoles(params.guild)[JAIL]
      ?.id;

    // Returning quietly here means a spammer the filters already decided to
    // jail just carries on, with nothing anywhere to say why.
    if (!jailRoleId) {
      botLogger.error(
        "Cannot jail member: this guild has no role matching the configured jail name",
        {
          guildId: params.guild.id,
          memberId: params.memberId,
          jailRoleName: JAIL ?? "(STATUS_ROLES has no jail entry)",
          reason: params.reason,
        },
      );
      return { status: "no-jail-role" };
    }

    const memberId = params.user?.id || params.memberId;
    const discordMember =
      params.guild.members.cache.get(memberId) ||
      (await params.guild.members.fetch(memberId).catch(() => null));
    const alreadyJailed = !!discordMember?.roles.cache.has(jailRoleId);

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
      await ModLogService.postLog({
        guild: params.guild,
        action: "jail",
        targetId: params.memberId,
        targetName: params.user?.username,
        moderatorId: params.moderatorId,
        moderatorName: params.moderatorName,
        reason: params.reason,
      });

      await this.sendJailNotification(params);
    }

    return { status: alreadyJailed ? "already-jailed" : "jailed" };
  }

  /**
   * Release a member from jail.
   *
   * Their old roles cannot come back: jailing strips every Discord role and
   * deletes their MemberRole rows, so nothing records what they had. The best
   * available outcome is removing the jail role and restoring the roles every
   * member starts with (Verified plus MEMBER_ROLES). Level and helper roles
   * have to be re-added by hand.
   */
  static async unjailUser(params: {
    guild: Guild;
    memberId: string;
    user: User | null;
    moderatorId?: string;
    moderatorName?: string;
    reason?: string;
  }): Promise<{ ok: boolean; message: string }> {
    const jailRoleId = RolesService.getGuildStatusRoles(params.guild)[JAIL]
      ?.id;

    if (!jailRoleId) {
      return {
        ok: false,
        message: "No jail role is configured on this server.",
      };
    }

    const discordMember =
      params.guild.members.cache.get(params.memberId) ||
      (await params.guild.members.fetch(params.memberId).catch(() => null));

    // Jailing works on members who have left - the jail row is re-applied if
    // they rejoin - so releasing them has to work the same way: clear the row.
    if (!discordMember) {
      const cleared = await db
        .delete(memberRole)
        .where(
          and(
            eq(memberRole.memberId, params.memberId),
            eq(memberRole.guildId, params.guild.id),
            eq(memberRole.roleId, jailRoleId),
          ),
        )
        .returning({ roleId: memberRole.roleId });

      if (!cleared.length) {
        return {
          ok: false,
          message: "That member is not in the server and has no jail on record.",
        };
      }

      await ModLogService.postLog({
        guild: params.guild,
        action: "unjail",
        targetId: params.memberId,
        targetName: params.user?.username,
        moderatorId: params.moderatorId,
        moderatorName: params.moderatorName,
        reason: params.reason,
      });

      return {
        ok: true,
        message: `<@${params.memberId}> is not in the server. Their jail record is cleared, so it will not be re-applied if they rejoin.`,
      };
    }

    if (!discordMember.roles.cache.has(jailRoleId)) {
      return { ok: false, message: "That member is not jailed." };
    }

    const role = params.guild.roles.cache.get(jailRoleId);
    if (!role?.editable) {
      return {
        ok: false,
        message:
          "I cannot manage the jail role - it sits above my highest role.",
      };
    }

    // The DB row goes first. RolesService refuses to record new roles for a
    // member while a jail row exists, so the roles restored below would
    // otherwise never reach the database.
    await db
      .delete(memberRole)
      .where(
        and(
          eq(memberRole.memberId, params.memberId),
          eq(memberRole.guildId, params.guild.id),
          eq(memberRole.roleId, jailRoleId),
        ),
      );

    await discordMember.roles.remove(jailRoleId).catch(error);

    const defaultRoles = new Set(
      [VERIFIED, ...MEMBER_ROLES].filter((name): name is string => !!name),
    );
    const restored: string[] = [];

    for (const name of defaultRoles) {
      const roleToAdd = params.guild.roles.cache.find((r) => r.name === name);
      if (!roleToAdd?.editable) continue;
      if (discordMember.roles.cache.has(roleToAdd.id)) continue;

      await discordMember.roles.add(roleToAdd.id).catch(error);
      restored.push(name);
    }

    await ModLogService.postLog({
      guild: params.guild,
      action: "unjail",
      targetId: params.memberId,
      targetName: params.user?.username ?? discordMember.user.username,
      moderatorId: params.moderatorId,
      moderatorName: params.moderatorName,
      reason: params.reason,
    });

    return {
      ok: true,
      message: restored.length
        ? `Unjailed <@${params.memberId}>. Restored: ${restored.join(", ")}. Level and helper roles were lost when they were jailed and need re-adding.`
        : `Unjailed <@${params.memberId}>. Any roles they had were lost when they were jailed, so they may need re-adding.`,
    };
  }

  /**
   * Delete user messages across all channels. Scoped to last 14 days.
   */
  static async deleteUserMessages(params: DeleteUserMessagesParams) {
    // A spammer's messages arrive faster than one sweep of 275 channels takes, and
    // every detector that catches them calls this, so without a guard the same user
    // gets several concurrent sweeps that each re-scan what the others deleted.
    const sweepKey = `${params.guild.id}:${params.memberId}`;
    if (this.activeSweeps.has(sweepKey)) {
      log(
        `[DeleteUserMessages] Sweep already running for user ${params.memberId}, skipping`,
      );
      return;
    }
    this.activeSweeps.add(sweepKey);

    try {
      await this.runDeletion(params);
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
