import { guildDerive } from "@/api/middleware/guild.derive";
import {
  parseMessage,
  parseMultipleUsersWithRoles,
} from "@/api/mappers/member.mapper";
import { PAGE_LIMIT } from "@/api/middleware/cache";
import { ChannelType } from "discord.js";
import { Elysia, status, t } from "elysia";

export const newsRoutes = new Elysia().use(guildDerive).get(
  "/api/:guildId/news",
  async ({ guild }) => {
    // Try cache first, only fetch from API if not found
    let newsChannel = guild.channels.cache.find((ch) =>
      ch?.name.toLowerCase().includes("news"),
    );

    if (!newsChannel) {
      const channels = await guild.channels.fetch();
      const found = channels.find((ch) =>
        ch?.name.toLowerCase().includes("news"),
      );
      if (found) newsChannel = found;
    }

    if (!newsChannel) throw status("Not Found", "News channel not found");
    if (
      newsChannel.type !== ChannelType.GuildText &&
      newsChannel.type !== ChannelType.GuildAnnouncement
    ) {
      throw status(
        "Bad Request",
        "News channel must be a text or announcement channel",
      );
    }

    // Try cache first, only fetch if cache is empty
    let messages = Array.from(newsChannel.messages.cache.values())
      .sort((a, b) => b.createdTimestamp - a.createdTimestamp)
      .slice(0, PAGE_LIMIT);

    if (messages.length === 0) {
      messages = Array.from(
        (await newsChannel.messages.fetch({ limit: PAGE_LIMIT })).values(),
      );
    }

    const authorIds = [...new Set(messages.map((msg) => msg.author.id))];
    const authors = await parseMultipleUsersWithRoles(authorIds, guild);

    return messages.map((message) => ({
      ...parseMessage(message),
      author: authors.find((a) => a.id === message.author.id)!,
    }));
  },
  { params: t.Object({ guildId: t.String() }) },
);
