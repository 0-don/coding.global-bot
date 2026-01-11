import {
  ChannelType,
  ForumChannel,
  Guild,
  Message,
  type AnyThreadChannel,
  type GuildTextBasedChannel,
} from "discord.js";
import { prisma } from "@/prisma";
import { logTs } from "@/shared/utils/date.utils";
import { ThreadService } from "@/core/services/threads/thread.service";

const runningGuilds = new Set<string>();

export function isSyncRunning(guildId: string): boolean {
  return runningGuilds.has(guildId);
}

export async function syncAllThreads(
  guild: Guild,
  channel: GuildTextBasedChannel,
): Promise<void> {
  const guildName = guild.name.slice(0, 20);

  if (runningGuilds.has(guild.id)) {
    await channel.send("Thread sync already running.");
    return;
  }

  runningGuilds.add(guild.id);

  try {
    // Ensure guild exists
    await prisma.guild.upsert({
      where: { guildId: guild.id },
      create: { guildId: guild.id, guildName: guild.name },
      update: { guildName: guild.name },
    });

    // Fetch all channels
    logTs("info", guildName, "Fetching channels...");
    const allChannels = await guild.channels.fetch();

    // Filter to forum channels
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

    // Load saved progress
    const saved = await prisma.syncProgress.findUnique({
      where: { guildId: guild.id },
    });
    const processedThreads = new Set(saved?.processedThreads ?? []);
    const failedThreads = new Set(saved?.failedThreads ?? []);

    // Collect all threads from all forums
    const allThreads: Array<{
      thread: AnyThreadChannel;
      boardType: string;
      forum: ForumChannel;
    }> = [];

    for (const [, forum] of forumChannels) {
      const boardType = ThreadService.getBoardTypeFromChannel(forum);

      // Sync tags for this forum
      await ThreadService.upsertTags(guild.id, forum.availableTags);

      logTs("info", guildName, `Fetching threads from ${forum.name}...`);

      try {
        // Fetch active threads
        const activeResult = await forum.threads.fetchActive(true);

        // Fetch archived threads
        const archivedPublic = await forum.threads.fetchArchived({ type: "public", limit: 100 });

        const archivedPrivate = await forum.threads.fetchArchived({ type: "private", limit: 100 });

        // Combine all threads
        for (const [, thread] of activeResult.threads) {
          allThreads.push({ thread, boardType, forum });
        }
        for (const [, thread] of archivedPublic.threads) {
          allThreads.push({ thread, boardType, forum });
        }
        for (const [, thread] of archivedPrivate.threads) {
          allThreads.push({ thread, boardType, forum });
        }

        logTs(
          "info",
          guildName,
          `Found ${activeResult.threads.size} active, ${archivedPublic.threads.size} archived public, ${archivedPrivate.threads.size} archived private in ${forum.name}`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logTs("error", guildName, `Failed to fetch threads from ${forum.name}: ${msg}`);
      }
    }

    // Filter out already processed threads
    const remaining = allThreads.filter((t) => !processedThreads.has(t.thread.id));
    const total = allThreads.length;
    const alreadyDone = processedThreads.size;

    const resumeMsg =
      alreadyDone > 0 ? ` (resuming: ${alreadyDone}/${total} done)` : "";
    logTs("info", guildName, `Processing ${remaining.length} threads${resumeMsg}`);
    const progressMsg = await channel.send(
      `Processing ${total} threads${resumeMsg}...`,
    );

    for (let i = 0; i < remaining.length; i++) {
      const { thread, boardType } = remaining[i];
      const tag = `${thread.name.slice(0, 30)} (${thread.id})`;

      try {
        // Upsert thread
        await ThreadService.upsertThread(thread, boardType);

        // Fetch and save all messages
        await syncThreadMessages(thread, guild.id);

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

      // Save progress
      await prisma.syncProgress.upsert({
        where: { guildId: guild.id },
        create: {
          guildId: guild.id,
          processedThreads: [...processedThreads],
          failedThreads: [...failedThreads],
        },
        update: {
          processedThreads: [...processedThreads],
          failedThreads: [...failedThreads],
        },
      });

      // Update Discord message every 10 threads or at the end
      if ((i + 1) % 10 === 0 || i + 1 === remaining.length) {
        const pct = Math.round((done / total) * 100);
        await progressMsg
          .edit(`Syncing threads: ${done}/${total} (${pct}%)`)
          .catch(() => {});
      }
    }

    // Clear progress on completion
    await prisma.syncProgress.delete({ where: { guildId: guild.id } }).catch(() => {});

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
    runningGuilds.delete(guild.id);
  }
}

async function syncThreadMessages(
  thread: AnyThreadChannel,
  guildId: string,
): Promise<void> {
  const PAGE_SIZE = 100;
  let lastMessageId: string | undefined;
  let hasMore = true;

  // First, try to get and save the starter message
  try {
    const starterMessage = await thread.fetchStarterMessage();
    if (starterMessage) {
      await upsertMessageToDb(starterMessage, thread.id, guildId);
    }
  } catch (_) {}

  // Then fetch all other messages
  while (hasMore) {
    const messages = await thread.messages.fetch({
      limit: PAGE_SIZE,
      ...(lastMessageId && { before: lastMessageId }),
    });

    if (messages.size === 0) {
      hasMore = false;
      break;
    }

    for (const [, message] of messages) {
      await upsertMessageToDb(message, thread.id, guildId);
    }

    lastMessageId = messages.last()?.id;
    hasMore = messages.size === PAGE_SIZE;
  }
}

async function upsertMessageToDb(
  message: Message,
  threadId: string,
  guildId: string,
): Promise<void> {
  const authorId = message.author.id;

  // Ensure author exists in database
  try {
    await prisma.member.upsert({
      where: { memberId: authorId },
      create: {
        memberId: authorId,
        username: message.author.username,
        globalName: message.author.globalName,
        bot: message.author.bot,
        system: message.author.system,
        avatarUrl: message.author.displayAvatarURL(),
        createdAt: message.author.createdAt,
      },
      update: {
        username: message.author.username,
        globalName: message.author.globalName,
        avatarUrl: message.author.displayAvatarURL(),
      },
    });
  } catch (_) {}

  // Save the message
  try {
    await prisma.threadReply.upsert({
      where: { id: message.id },
      create: {
        id: message.id,
        threadId,
        authorId,
        guildId,
        content: message.content,
        createdAt: message.createdAt,
        editedAt: message.editedAt,
        pinned: message.pinned,
        tts: message.tts,
        type: message.type.toString(),
        attachments: Array.from(message.attachments.values()).map((att) => ({
          id: att.id,
          url: att.url,
          proxyURL: att.proxyURL,
          name: att.name,
          description: att.description || null,
          contentType: att.contentType || null,
          size: att.size,
          width: att.width || null,
          height: att.height || null,
          ephemeral: att.ephemeral,
          duration: att.duration || null,
          waveform: att.waveform || null,
          flags: att.flags?.bitfield.toString() || null,
        })),
        embeds: message.embeds.map((embed) => ({
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
        })),
        mentions: {
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
        },
        reactions: message.reactions.cache.map((reaction) => ({
          emoji: {
            id: reaction.emoji.id,
            name: reaction.emoji.name,
          },
          count: reaction.count,
        })),
        reference: message.reference
          ? {
              messageId: message.reference.messageId || null,
              channelId: message.reference.channelId,
              guildId: message.reference.guildId || null,
            }
          : undefined,
      },
      update: {
        content: message.content,
        editedAt: message.editedAt,
        pinned: message.pinned,
        attachments: Array.from(message.attachments.values()).map((att) => ({
          id: att.id,
          url: att.url,
          proxyURL: att.proxyURL,
          name: att.name,
          description: att.description || null,
          contentType: att.contentType || null,
          size: att.size,
          width: att.width || null,
          height: att.height || null,
          ephemeral: att.ephemeral,
          duration: att.duration || null,
          waveform: att.waveform || null,
          flags: att.flags?.bitfield.toString() || null,
        })),
        embeds: message.embeds.map((embed) => ({
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
        })),
        mentions: {
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
        },
        reactions: message.reactions.cache.map((reaction) => ({
          emoji: {
            id: reaction.emoji.id,
            name: reaction.emoji.name,
          },
          count: reaction.count,
        })),
      },
    });
  } catch (_) {}
}
