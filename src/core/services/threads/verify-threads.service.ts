import { ThreadService } from "@/core/services/threads/thread.service";
import { UNKNOWN_CHANNEL, UNKNOWN_MESSAGE } from "@/core/utils/command.utils";
import { db } from "@/lib/db";
import { guild, member, threadMessage, syncProgress } from "@/lib/db-schema";
import { and, eq } from "drizzle-orm";
import { logTs } from "@/shared/utils/date.utils";
import {
  ChannelType,
  ForumChannel,
  Guild,
  Message,
  type AnyThreadChannel,
  type GuildTextBasedChannel,
} from "discord.js";

export class SyncAllThreadsService {
  private static runningGuilds = new Set<string>();

  static isSyncRunning(guildId: string): boolean {
    return this.runningGuilds.has(guildId);
  }

  static async syncAllThreads(
    discordGuild: Guild,
    channel: GuildTextBasedChannel,
  ): Promise<void> {
    const guildName = discordGuild.name.slice(0, 20);

    if (this.runningGuilds.has(discordGuild.id)) {
      await channel.send("Thread sync already running.");
      return;
    }

    this.runningGuilds.add(discordGuild.id);

    try {
      const gatheringMsg = await channel.send("Starting thread sync...");

      await db.insert(guild)
        .values({ guildId: discordGuild.id, guildName: discordGuild.name })
        .onConflictDoUpdate({
          target: guild.guildId,
          set: { guildName: discordGuild.name },
        });

      logTs("info", guildName, "Fetching channels...");
      const allChannels = await discordGuild.channels.fetch();

      const forumChannels = allChannels.filter(
        (ch): ch is ForumChannel => ch?.type === ChannelType.GuildForum,
      );

      if (forumChannels.size === 0) {
        await channel.send("No forum channels found.");
        return;
      }

      logTs(
        "info",
        guildName,
        `Found ${forumChannels.size} forum channel(s): ${forumChannels.map((f) => f.name).join(", ")}`,
      );

      const saved = await db.query.syncProgress.findFirst({
        where: and(
          eq(syncProgress.guildId, discordGuild.id),
          eq(syncProgress.type, "threads"),
        ),
      });
      const processedThreads = new Set(saved?.processedIds ?? []);
      const failedThreads = new Set(saved?.failedIds ?? []);

      const allThreads: Array<{
        thread: AnyThreadChannel;
        threadType: string;
        forum: ForumChannel;
      }> = [];

      const forumArray = Array.from(forumChannels.values());
      for (let f = 0; f < forumArray.length; f++) {
        const forum = forumArray[f];
        const threadType = ThreadService.getThreadTypeFromChannel(forum);

        await ThreadService.upsertTags(discordGuild.id, forum.availableTags);

        if (f === 0 || (f + 1) % 5 === 0 || f + 1 === forumArray.length) {
          await gatheringMsg
            .edit(
              `Gathering threads: ${f + 1}/${forumArray.length} forums (${forum.name})...`,
            )
            .catch(() => {});
        }

        logTs("info", guildName, `Fetching threads from ${forum.name}...`);

        try {
          const activeResult = await forum.threads.fetchActive(true);

          // Fetch all archived public threads with pagination
          const archivedPublicThreads: AnyThreadChannel[] = [];
          let hasMorePublic = true;
          let beforePublic: string | undefined;
          while (hasMorePublic) {
            const result = await forum.threads.fetchArchived({
              type: "public",
              limit: 100,
              before: beforePublic,
            });
            for (const [, thread] of result.threads) {
              archivedPublicThreads.push(thread);
            }
            hasMorePublic = result.hasMore;
            beforePublic = result.threads.last()?.id;
          }

          // Fetch all archived private threads with pagination
          const archivedPrivateThreads: AnyThreadChannel[] = [];
          let hasMorePrivate = true;
          let beforePrivate: string | undefined;
          while (hasMorePrivate) {
            const result = await forum.threads.fetchArchived({
              type: "private",
              limit: 100,
              before: beforePrivate,
            });
            for (const [, thread] of result.threads) {
              archivedPrivateThreads.push(thread);
            }
            hasMorePrivate = result.hasMore;
            beforePrivate = result.threads.last()?.id;
          }

          for (const [, thread] of activeResult.threads) {
            allThreads.push({ thread, threadType, forum });
          }
          for (const thread of archivedPublicThreads) {
            allThreads.push({ thread, threadType, forum });
          }
          for (const thread of archivedPrivateThreads) {
            allThreads.push({ thread, threadType, forum });
          }

          logTs(
            "info",
            guildName,
            `Found ${activeResult.threads.size} active, ${archivedPublicThreads.length} archived public, ${archivedPrivateThreads.length} archived private in ${forum.name}`,
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logTs(
            "error",
            guildName,
            `Failed to fetch threads from ${forum.name}: ${msg}`,
          );
        }
      }

      await gatheringMsg
        .edit(
          `Gathered ${allThreads.length} threads from ${forumArray.length} forums`,
        )
        .catch(() => {});

      const remaining = allThreads.filter(
        (t) => !processedThreads.has(t.thread.id),
      );
      const total = allThreads.length;
      const alreadyDone = processedThreads.size;

      const resumeMsg =
        alreadyDone > 0 ? ` (resuming: ${alreadyDone}/${total} done)` : "";
      logTs(
        "info",
        guildName,
        `Processing ${remaining.length} threads${resumeMsg}`,
      );
      const progressMsg = await channel.send(
        `Processing ${total} threads${resumeMsg}...`,
      );

      for (let i = 0; i < remaining.length; i++) {
        const { thread, threadType } = remaining[i];
        const tag = `${thread.name.slice(0, 30)} (${thread.id})`;

        try {
          await ThreadService.upsertThread(thread, threadType);

          await this.syncThreadMessages(thread, discordGuild.id);

          processedThreads.add(thread.id);
          logTs(
            "info",
            guildName,
            `✓ ${tag} (${alreadyDone + i + 1}/${total})`,
          );
        } catch {
          failedThreads.add(thread.id);
          logTs(
            "error",
            guildName,
            `✗ ${tag} (${alreadyDone + i + 1}/${total})`,
          );
        }

        const done = alreadyDone + i + 1;

        await db.insert(syncProgress)
          .values({
            guildId: discordGuild.id,
            type: "threads",
            processedIds: [...processedThreads],
            failedIds: [...failedThreads],
          })
          .onConflictDoUpdate({
            target: [syncProgress.guildId, syncProgress.type],
            set: {
              processedIds: [...processedThreads],
              failedIds: [...failedThreads],
            },
          });

        if ((i + 1) % 10 === 0 || i + 1 === remaining.length) {
          const pct = Math.round((done / total) * 100);
          await progressMsg
            .edit(`Syncing threads: ${done}/${total} (${pct}%)`)
            .catch(() => {});
        }
      }

      await db.delete(syncProgress)
        .where(
          and(
            eq(syncProgress.guildId, discordGuild.id),
            eq(syncProgress.type, "threads"),
          )
        )
        .catch(() => {});

      const result =
        failedThreads.size > 0
          ? `Done! Synced ${total} threads (${failedThreads.size} failed)`
          : `Done! Synced ${total} threads`;
      await progressMsg.edit(result).catch(() => {});
      logTs("info", guildName, result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logTs("error", guildName, `Thread sync failed: ${msg}`);
      await channel.send(`Error: ${msg}. Run again to resume.`);
      throw err;
    } finally {
      this.runningGuilds.delete(discordGuild.id);
    }
  }

  static async syncThreadMessages(
    thread: AnyThreadChannel,
    guildId: string,
  ): Promise<void> {
    const PAGE_SIZE = 100;
    let lastMessageId: string | undefined;
    let hasMore = true;

    try {
      const starterMessage = await thread.fetchStarterMessage();
      if (starterMessage) {
        await this.upsertMessageToDb(starterMessage, thread.id, guildId);
      }
    } catch (_) {}

    while (hasMore) {
      try {
        const messages = await thread.messages.fetch({
          limit: PAGE_SIZE,
          ...(lastMessageId && { before: lastMessageId }),
        });

        if (messages.size === 0) {
          hasMore = false;
          break;
        }

        for (const [, message] of messages) {
          await this.upsertMessageToDb(message, thread.id, guildId);
        }

        lastMessageId = messages.last()?.id;
        hasMore = messages.size === PAGE_SIZE;
      } catch (err) {
        const code = (err as { code?: number }).code;
        // Thread/channel was deleted, stop syncing
        if (code === UNKNOWN_CHANNEL || code === UNKNOWN_MESSAGE) {
          return;
        }
        throw err;
      }
    }
  }

  static async upsertMessageToDb(
    message: Message,
    threadId: string,
    guildId: string,
  ): Promise<void> {
    const authorId = message.author.id;

    try {
      await db.insert(member)
        .values({
          memberId: authorId,
          username: message.author.username,
          globalName: message.author.globalName,
          bot: message.author.bot,
          system: message.author.system,
          avatarUrl: message.author.displayAvatarURL(),
          createdAt: message.author.createdAt.toISOString(),
        })
        .onConflictDoUpdate({
          target: member.memberId,
          set: {
            username: message.author.username,
            globalName: message.author.globalName,
            avatarUrl: message.author.displayAvatarURL(),
          },
        });
    } catch (_) {}

    try {
      const embedsData = message.embeds.map((embed) => ({
        title: embed.title || null,
        description: embed.description || null,
        url: embed.url || null,
        color: embed.color || null,
        timestamp: embed.timestamp || null,
        fields: embed.fields.map((field) => ({
          name: field.name,
          value: field.value,
          inline: field.inline,
        })),
        author: embed.author
          ? {
              name: embed.author.name,
              url: embed.author.url || null,
              iconURL: embed.author.iconURL || null,
              proxyIconURL: embed.author.proxyIconURL || null,
            }
          : null,
        thumbnail: embed.thumbnail
          ? {
              url: embed.thumbnail.url,
              proxyURL: embed.thumbnail.proxyURL || null,
              width: embed.thumbnail.width || null,
              height: embed.thumbnail.height || null,
            }
          : null,
        image: embed.image
          ? {
              url: embed.image.url,
              proxyURL: embed.image.proxyURL || null,
              width: embed.image.width || null,
              height: embed.image.height || null,
            }
          : null,
        video: embed.video
          ? {
              url: embed.video.url || null,
              proxyURL: embed.video.proxyURL || null,
              width: embed.video.width || null,
              height: embed.video.height || null,
            }
          : null,
        footer: embed.footer
          ? {
              text: embed.footer.text,
              iconURL: embed.footer.iconURL || null,
              proxyIconURL: embed.footer.proxyIconURL || null,
            }
          : null,
        provider: embed.provider
          ? {
              name: embed.provider.name || null,
              url: embed.provider.url || null,
            }
          : null,
      }));

      const mentionsData = {
        users: message.mentions.users.map((user) => ({
          id: user.id,
          username: user.username,
          globalName: user.globalName,
        })),
        roles: message.mentions.roles.map((role) => ({
          id: role.id,
          name: role.name,
        })),
        everyone: message.mentions.everyone,
      };

      const reactionsData = message.reactions.cache.map((reaction) => ({
        emoji: {
          id: reaction.emoji.id,
          name: reaction.emoji.name,
        },
        count: reaction.count,
      }));

      const referenceData = message.reference
        ? {
            messageId: message.reference.messageId || null,
            channelId: message.reference.channelId,
            guildId: message.reference.guildId || null,
          }
        : null;

      await db.insert(threadMessage)
        .values({
          id: message.id,
          threadId,
          authorId,
          guildId,
          content: message.content,
          createdAt: message.createdAt.toISOString(),
          editedAt: message.editedAt?.toISOString() ?? null,
          pinned: message.pinned,
          tts: message.tts,
          type: message.type.toString(),
          embeds: embedsData,
          mentions: mentionsData,
          reactions: reactionsData,
          reference: referenceData,
        })
        .onConflictDoUpdate({
          target: threadMessage.id,
          set: {
            content: message.content,
            editedAt: message.editedAt?.toISOString() ?? null,
            pinned: message.pinned,
            embeds: embedsData,
            mentions: mentionsData,
            reactions: reactionsData,
          },
        });

      await ThreadService.upsertAttachments(
        message.id,
        Array.from(message.attachments.values()),
      );
    } catch (_) {}
  }
}
