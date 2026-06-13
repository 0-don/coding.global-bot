import { ThreadService } from "@/core/services/threads/thread.service";
import { UNKNOWN_CHANNEL, UNKNOWN_MESSAGE } from "@/core/utils/command.utils";
import { logTs } from "@/shared/utils/date.utils";
import {
  ChannelType,
  ForumChannel,
  Guild,
  type AnyThreadChannel,
  type GuildTextBasedChannel,
} from "discord.js";

const OLD_URL = "https://coding.global/";
const NEW_URL = "https://coding-global.com/";

export class MigrateThreadUrlsService {
  private static runningGuilds = new Set<string>();

  static isRunning(guildId: string): boolean {
    return this.runningGuilds.has(guildId);
  }

  static async migrateAllThreadUrls(
    discordGuild: Guild,
    channel: GuildTextBasedChannel,
  ): Promise<void> {
    const guildName = discordGuild.name.slice(0, 20);

    if (this.runningGuilds.has(discordGuild.id)) {
      await channel.send("URL migration already running.");
      return;
    }

    this.runningGuilds.add(discordGuild.id);

    try {
      const gatheringMsg = await channel.send("Gathering threads...");

      const allChannels = await discordGuild.channels.fetch();
      const forumChannels = allChannels.filter(
        (ch): ch is ForumChannel => ch?.type === ChannelType.GuildForum,
      );

      if (forumChannels.size === 0) {
        await gatheringMsg.edit("No forum channels found.").catch(() => {});
        return;
      }

      const allThreads = await this.gatherThreads(
        Array.from(forumChannels.values()),
        gatheringMsg,
        guildName,
      );

      await gatheringMsg
        .edit(`Gathered ${allThreads.length} threads. Migrating URLs...`)
        .catch(() => {});

      const progressMsg = await channel.send("Migrating: 0 edited...");
      let edited = 0;
      let scanned = 0;

      for (let i = 0; i < allThreads.length; i++) {
        const thread = allThreads[i];
        try {
          edited += await this.migrateThreadMessages(thread);
        } catch (err) {
          const code = (err as { code?: number }).code;
          if (code !== UNKNOWN_CHANNEL && code !== UNKNOWN_MESSAGE) {
            logTs(
              "error",
              guildName,
              `Failed migrating ${thread.name.slice(0, 30)} (${thread.id})`,
            );
          }
        }
        scanned = i + 1;

        if (scanned % 10 === 0 || scanned === allThreads.length) {
          await progressMsg
            .edit(
              `Migrating: ${scanned}/${allThreads.length} threads, ${edited} message(s) edited`,
            )
            .catch(() => {});
        }
      }

      const result = `Done. Scanned ${allThreads.length} threads, edited ${edited} message(s) from ${OLD_URL} to ${NEW_URL}`;
      await progressMsg.edit(result).catch(() => {});
      logTs("info", guildName, result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logTs("error", guildName, `URL migration failed: ${msg}`);
      await channel.send(`Error: ${msg}`);
      throw err;
    } finally {
      this.runningGuilds.delete(discordGuild.id);
    }
  }

  private static async gatherThreads(
    forumArray: ForumChannel[],
    gatheringMsg: { edit: (c: string) => Promise<unknown> },
    guildName: string,
  ): Promise<AnyThreadChannel[]> {
    const allThreads: AnyThreadChannel[] = [];

    for (let f = 0; f < forumArray.length; f++) {
      const forum = forumArray[f];

      if (f === 0 || (f + 1) % 5 === 0 || f + 1 === forumArray.length) {
        await gatheringMsg
          .edit(`Gathering threads: ${f + 1}/${forumArray.length} forums (${forum.name})...`)
          .catch(() => {});
      }

      try {
        const activeResult = await forum.threads.fetchActive(true);
        for (const [, thread] of activeResult.threads) allThreads.push(thread);

        for (const type of ["public", "private"] as const) {
          let hasMore = true;
          let before: string | undefined;
          while (hasMore) {
            const result = await forum.threads.fetchArchived({
              type,
              limit: 100,
              before,
            });
            for (const [, thread] of result.threads) allThreads.push(thread);
            hasMore = result.hasMore;
            before = result.threads.last()?.id;
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logTs("error", guildName, `Failed to fetch threads from ${forum.name}: ${msg}`);
      }
    }

    return allThreads;
  }

  // Edit every bot-authored embed message in the thread whose description still
  // points at the old domain. Returns the number of messages edited.
  private static async migrateThreadMessages(
    thread: AnyThreadChannel,
  ): Promise<number> {
    const botId = thread.client.user.id;
    const PAGE_SIZE = 100;
    let lastMessageId: string | undefined;
    let hasMore = true;
    let edited = 0;

    while (hasMore) {
      const messages = await thread.messages.fetch({
        limit: PAGE_SIZE,
        ...(lastMessageId && { before: lastMessageId }),
      });

      if (messages.size === 0) break;

      for (const [, message] of messages) {
        if (message.author.id !== botId || message.embeds.length === 0) continue;

        const needsEdit = message.embeds.some((embed) =>
          embed.description?.includes(OLD_URL),
        );
        if (!needsEdit) continue;

        const newEmbeds = message.embeds.map((embed) => {
          const data = embed.toJSON();
          if (data.description?.includes(OLD_URL)) {
            data.description = data.description.split(OLD_URL).join(NEW_URL);
          }
          return data;
        });

        try {
          await message.edit({ embeds: newEmbeds });
          edited++;
        } catch (_) {}
      }

      lastMessageId = messages.last()?.id;
      hasMore = messages.size === PAGE_SIZE;
    }

    return edited;
  }
}
