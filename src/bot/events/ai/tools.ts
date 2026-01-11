import { tool } from "ai";
import { z } from "zod/v4";
import { ConfigValidator } from "@/shared/config/validator";
import { GifService } from "@/core/services/gif/gif.service";
import { StatsService } from "@/core/services/stats/stats.service";
import { bot } from "@/main";
import { log } from "console";

export const gatherChannelContext = tool({
  description:
    "Gather recent messages and user context from a specific channel when you need more conversation history to provide better responses.",
  inputSchema: z.object({
    channelId: z
      .string()
      .describe("The Discord channel ID to fetch messages from"),
    guildId: z.string().describe("The Discord guild/server ID"),
    messageCount: z
      .number()
      .min(1)
      .max(50)
      .default(10)
      .describe("Number of recent messages to fetch (1-50)"),
  }),
  execute: async ({ channelId, guildId, messageCount }) => {
    try {
      log(
        `Gathering AI context from channel ${channelId} in guild ${guildId}...`,
      );
      const guild = await bot.guilds.fetch(guildId).catch(() => null);
      if (!guild) {
        return { success: false, error: "Guild not found" };
      }

      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (!channel || !channel.isTextBased()) {
        return { success: false, error: "Channel not found or not text-based" };
      }

      // Fetch recent messages
      const messages = await channel.messages.fetch({ limit: messageCount });
      const sortedMessages = Array.from(messages.values())
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
        .filter((msg) => !msg.author.bot); // Filter out bot messages

      // Gather context for each unique user
      const userContexts = new Map<string, any>();
      const messageContexts = [];

      for (const message of sortedMessages) {
        // Get user context if we haven't already
        if (!userContexts.has(message.author.id)) {
          try {
            const userStats = await StatsService.getUserStatsEmbed(
              message.author.id,
              guildId,
            );
            userContexts.set(message.author.id, userStats);
          } catch (error) {
            userContexts.set(message.author.id, null);
          }
        }

        const userContext = userContexts.get(message.author.id);

        messageContexts.push({
          timestamp: message.createdAt.toISOString(),
          author: {
            id: message.author.id,
            username: message.author.username,
            displayName: message.author.globalName,
            stats: userContext
              ? {
                  roles: userContext.roles?.filter(Boolean) || [],
                  // Include key stats without overwhelming detail
                  messageCount:
                    userContext.embed?.fields?.[0]?.value || "Unknown",
                  voiceTime: userContext.embed?.fields?.[1]?.value || "Unknown",
                }
              : null,
          },
          content: message.content,
          hasAttachments: message.attachments.size > 0,
          isReply: !!message.reference,
          replyToId: message.reference?.messageId,
        });
      }

      return {
        success: true,
        context: {
          messageCount: messageContexts.length,
          messages: messageContexts,
          fetchedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error("Error gathering channel context:", error);
      return {
        success: false,
        error: `Failed to gather channel context: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});

export const searchMemeGifs = tool({
  description:
    "Search for and send a meme GIF to enhance your response with visual humor.",
  inputSchema: z.object({
    query: z.string().describe("Search query for the GIF"),
  }),
  execute: async ({ query }: { query: string }) => {
    if (!ConfigValidator.isFeatureEnabled("TENOR_API_KEY")) {
      return { success: false, error: "GIF search not available" };
    }

    const gifs = await GifService.searchGifs(query, 10);
    for (const gif of gifs) {
      try {
        const response = await fetch(gif, { method: "HEAD" });
        const size = parseInt(response.headers.get("content-length") ?? "0");
        if (size && size < 8 * 1024 * 1024) {
          return { success: true, gifUrl: gif };
        }
      } catch {
        continue;
      }
    }
    return { success: false, error: "No suitable GIF found" };
  },
});
