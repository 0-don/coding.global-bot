import { GoogleGenAI } from "@google/genai";
import { TextChannel } from "discord.js";
import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";
import { BOT_CHANNELS } from "../../lib/constants";
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

  getHistory() {
    return [...this.history];
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
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

@Discord()
export class aiChat {
  @On()
  async messageCreate([message]: ArgsOf<"messageCreate">, client: Client) {
    if (message.author.bot) return;

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
    ) {
      return;
    }

    const userMessage = message.content
      .replace(mentionRegex, "")
      .replace(/^coding global/i, "")
      .trim();

    if (!userMessage) {
      await message.reply("if u are pinning me u should say something :/");
      return;
    }

    const historyManager =
      channelHistory.get(message.channel.id) ??
      channelHistory
        .set(message.channel.id, new ChatHistoryManager())
        .get(message.channel.id)!;

    historyManager.addMessage("user", userMessage);

    try {
      const result = await ai.models.generateContent({
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
      });

      const responseText =
        result.candidates?.[0]?.content?.parts?.[0]?.text ??
        "Hmm... I'm not sure how to respond to that.";

      historyManager.addMessage("model", responseText);
      await message.reply(responseText);
    } catch (error) {
      console.error("Error generating AI response:", error);
      await message.reply(
        "Something went wrong while trying to think. Try again later!"
      );
    }
  }
}

setInterval(async () => {
  try {
    const data = await fetch(
      "https://isolated-emili-spectredev-9a803c60.koyeb.app/api/api"
    ).then((res) => res.json());
    console.log(data);
  } catch (err) {
    console.error("Ping error:", err);
  }
}, 300000);
