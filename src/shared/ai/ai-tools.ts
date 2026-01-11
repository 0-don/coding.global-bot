import { tool } from "ai";
import { log } from "console";
import { z } from "zod/v4";
import { ConfigValidator } from "@/shared/config/validator";
import { StatsService } from "@/core/services/stats/stats.service";
import { bot } from "@/main";

const TENOR_API_KEY = process.env.TENOR_API_KEY;
const TENOR_BASE_URL = "https://tenor.googleapis.com/v2/search";

async function searchGifs(query: string, limit: number = 5): Promise<string[]> {
  if (!TENOR_API_KEY) {
    console.warn("TENOR_API_KEY not configured - GIF search disabled");
    return [];
  }

  try {
    const params = new URLSearchParams({
      q: query,
      key: TENOR_API_KEY,
      limit: limit.toString(),
      contentfilter: "off",
      media_filter: "gif",
      random: "true",
    });

    const response = await fetch(`${TENOR_BASE_URL}?${params}`);

    if (!response.ok) {
      throw new Error(`Tenor API error: ${response.status}`);
    }

    const data = await response.json();

    return (
      data.results
        ?.map((result: any) => result.media_formats?.gif?.url)
        .filter(Boolean) || []
    );
  } catch (error) {
    console.error("Error fetching GIFs:", error);
    return [];
  }
}

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

      const messages = await channel.messages.fetch({ limit: messageCount });
      const sortedMessages = Array.from(messages.values())
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
        .filter((msg) => !msg.author.bot);

      const userContexts = new Map<string, any>();
      const messageContexts = [];

      for (const message of sortedMessages) {
        if (!userContexts.has(message.author.id)) {
          try {
            const userStats = await StatsService.getUserStatsEmbed(
              message.author.id,
              guildId,
            );
            userContexts.set(message.author.id, userStats);
          } catch {
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

    const gifs = await searchGifs(query, 10);
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

export const CODING_GLOBAL_PATTERN = /^coding\s?global/i;

export const AI_TOOLS = { searchMemeGifs, gatherChannelContext };
