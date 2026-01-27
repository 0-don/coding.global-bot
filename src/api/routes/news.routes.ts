import { guildDerive } from "@/api/middleware/guild.derive";
import { getMembers, parseMessage } from "@/api/mappers/member.mapper";
import { PAGE_LIMIT } from "@/api/middleware/cache";
import { extractUserIdsFromContent } from "@/shared/mappers/discord.mapper";
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

    const parsed = messages.map((message) => parseMessage(message));

    // Collect all user IDs: authors + mentions + content references
    const userIds = new Set<string>();
    messages.forEach((msg) => userIds.add(msg.author.id));
    for (const msg of parsed) {
      msg.mentions.users.forEach((u) => userIds.add(u.id));
      extractUserIdsFromContent(msg.content, msg.embeds).forEach((id) => userIds.add(id));
    }

    const resolved = await getMembers([...userIds], guild, { activeOnly: true });
    const userMap = new Map(resolved.map((u) => [u.id, u]));

    return messages.map((message, i) => {
      const { mentions, ...rest } = parsed[i];
      const mentionUserIds = [
        
        ...new Set([
          ...mentions.users.map((u) => u.id),
          ...extractUserIdsFromContent(rest.content, rest.embeds),
        ]),
      ];

      return {
        ...rest,
        mentions: {
          roles: mentions.roles,
          everyone: mentions.everyone,
          users: mentionUserIds
            .map((id) => userMap.get(id))
            .filter((u): u is NonNullable<typeof u> => !!u),
        },
        author: userMap.get(message.author.id)!,
      };
    });
  },
  { params: t.Object({ guildId: t.String() }) },
);
