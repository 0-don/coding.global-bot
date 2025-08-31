import { FunctionDeclaration, GoogleGenAI } from "@google/genai";
import { error } from "console";
import { TextChannel } from "discord.js";
import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";
import { ConfigValidator } from "../../lib/config-validator";
import { BOT_CHANNELS } from "../../lib/constants";
import { GifService } from "../../lib/gif/gif.service";
import { Ai_prompt } from "./prompt";

interface ChatMessage {
  role: "user" | "model";
  parts: { text: string }[];
}

class ChatHistoryManager {
  private history: ChatMessage[] = [];

  addMessage(role: "user" | "model", text: string) {
    this.history.push({ role, parts: [{ text }] });
  }

  formatHistory() {
    return this.history
      .map(
        (msg) => `${msg.role === "user" ? "User" : "Bot"}: ${msg.parts[0].text}`
      )
      .join("\n");
  }
}

const channelHistory = new Map<string, ChatHistoryManager>();

const GOOGLE_GEN_AI = ConfigValidator.isFeatureEnabled("GEMINI_API_KEY")
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
  : null;

// Helper function to check file size
async function getFileSize(url: string): Promise<number> {
  try {
    const response = await fetch(url, { method: "HEAD" });
    const contentLength = response.headers.get("content-length");
    return contentLength ? parseInt(contentLength, 10) : 0;
  } catch {
    return 0;
  }
}

@Discord()
export class AiChat {
  @On()
  async messageCreate([message]: ArgsOf<"messageCreate">, client: Client) {
    if (message.author.bot) return;
    if (!ConfigValidator.isFeatureEnabled("GEMINI_API_KEY")) return;
    if (!ConfigValidator.isFeatureEnabled("BOT_CHANNELS")) return;

    const channel = (await message.channel.fetch()) as TextChannel;
    if (!BOT_CHANNELS.includes(channel.name)) return;

    const mentionRegex = new RegExp(`^<@!?${client.user?.id}>`);
    const isMentioned = mentionRegex.test(message.content);
    const isReplyToBot =
      message.reference &&
      (
        await message.channel.messages
          .fetch(message.reference.messageId!)
          .catch(() => null)
      )?.author.id === client.user?.id;

    if (
      !isMentioned &&
      !isReplyToBot &&
      !message.content.toLowerCase().startsWith("coding global")
    )
      return;

    const userMessage = message.content
      .replace(mentionRegex, "")
      .replace(/^coding global/i, "")
      .trim();
    if (!userMessage) {
      await message.reply("if u are pinging me u should say something :/");
      return;
    }

    const historyManager =
      channelHistory.get(message.channel.id) ??
      channelHistory
        .set(message.channel.id, new ChatHistoryManager())
        .get(message.channel.id)!;

    historyManager.addMessage("user", userMessage);

    try {
      const searchMemeGifs: FunctionDeclaration = {
        name: "search_meme_gifs",
        description:
          "Search for meme GIFs when user asks for memes or when a reaction GIF would enhance response.",
        parametersJsonSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "GIF search query" },
          },
          required: ["query"],
        },
      };

      const result = await GOOGLE_GEN_AI?.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${Ai_prompt.promptText}\n\nPrevious conversation:\n${historyManager.formatHistory()}\n\nNow reply to:\n"${userMessage}"`,
              },
            ],
          },
        ],
        config: { tools: [{ functionDeclarations: [searchMemeGifs] }] },
      });

      const functionCall = result?.functionCalls?.[0];
      if (functionCall?.name === "search_meme_gifs") {
        const { query } = functionCall.args as { query: string };
        let gifUrl: string | null = null;
        let gifStatus = "No GIF found";

        if (ConfigValidator.isFeatureEnabled("TENOR_API_KEY")) {
          const gifs = await GifService.searchGifs(query, 10); // Get more options

          // Try to find a GIF under Discord's file size limit (8MB)
          for (const gif of gifs) {
            const fileSize = await getFileSize(gif);
            if (fileSize > 0 && fileSize < 8 * 1024 * 1024) {
              // 8MB limit
              gifUrl = gif;
              gifStatus = "GIF attached";
              break;
            }
          }

          if (!gifUrl && gifs.length > 0) {
            gifStatus = "GIF found but too large for Discord";
          }
        } else {
          gifStatus = "GIF search not configured";
        }

        const followUpResult = await GOOGLE_GEN_AI?.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `${Ai_prompt.promptText}\n\nPrevious conversation:\n${historyManager.formatHistory()}\n\nNow reply to:\n"${userMessage}"`,
                },
              ],
            },
            {
              role: "model",
              parts: [
                {
                  functionCall: {
                    name: functionCall.name,
                    args: functionCall.args,
                  },
                },
              ],
            },
            {
              role: "user",
              parts: [
                {
                  functionResponse: {
                    name: functionCall.name,
                    response: { result: gifStatus },
                  },
                },
              ],
            },
          ],
        });

        const responseText = followUpResult?.text || "Something went wrong...";

        try {
          await message.reply({
            content: responseText,
            files: gifUrl
              ? [{ attachment: gifUrl, name: "reaction.gif" }]
              : undefined,
          });
        } catch (discordError: any) {
          // If Discord upload fails, just send the text response
          await message.reply(responseText);
          error("Discord file upload error:", discordError.message);
        }

        historyManager.addMessage(
          "model",
          responseText + (gifUrl ? " [sent GIF]" : "")
        );
        return;
      }

      const responseText =
        result?.text || "Hmm... I'm not sure how to respond to that.";
      historyManager.addMessage("model", responseText);
      await message.reply(responseText);
    } catch (err) {
      error("Error generating AI response:", err);
      await message.reply(
        "Something went wrong while trying to think. Try again later!"
      );
    }
  }
}

setInterval(async () => {
  try {
    await fetch("https://isolated-emili-spectredev-9a803c60.koyeb.app/api/api");
  } catch (err) {
    error("Ping error:", err);
  }
}, 300000);
