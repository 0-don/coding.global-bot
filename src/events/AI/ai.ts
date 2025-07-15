import { Discord, On, Client, ArgsOf } from "discordx";
import { Message, TextChannel } from "discord.js";
import {
  BOT_CHANNELS,
  IS_CONSTRAINED_TO_BOT_CHANNEL,
} from "../../lib/constants.js";
import { Ai_prompt } from "./prompt.js";
import { GoogleGenAI } from "@google/genai";
 
import { bot } from "../../main.js";

type Role = "user" | "model";
interface ChatMessage {
  role: Role;
  parts: { text: string }[];
}

class ChatHistoryManager {
  private history: ChatMessage[] = [];

  addMessage(role: Role, text: string): void {
    this.history.push({ role, parts: [{ text }] });
  }

  getHistory(): ChatMessage[] {
    return [...this.history];
  }
}

async function getMemberCount(guildId: string): Promise<string> {
  try {
    const guild = await bot.guilds.fetch(guildId);
    if (!guild) return "Server not found.";
    const memberCount = guild.memberCount;
    return `${memberCount}`;
  } catch (error) {
    console.error("Error fetching member count:", error);
    return "I couldn't fetch the member count, u can check your self at the top of the channels list";
  }
}

const channelHistory = new Map<string, ChatHistoryManager>();

function formatHistory(history: ChatMessage[]): string {
  return history.map(msg => `${msg.role === "user" ? "User" : "Bot"}: ${msg.parts[0].text}`).join("\n");
}

const apiKey = process.env.API_KEY;

@Discord()
export class aiChat {
  @On()
  async messageCreate([message]: ArgsOf<"messageCreate">, client: Client): Promise<void> {
    if (message.author.bot) return;

    const mentionRegex = new RegExp(`^<@!?${client.user?.id}>`);
    const isMentioned = mentionRegex.test(message.content);

    if (!isMentioned && !message.content.toLowerCase().startsWith("coding global")) {
      return;
    }

    const userMessage = message.content
      .replace(mentionRegex, "")
      .trim()
      .replace(/^coding global/i, "")
      .trim();

    if (!userMessage) {
      await message.reply("You said... nothing? How profound.");
      return;
    }

    const channelId = message.channel.id;

    if (!channelHistory.has(channelId)) {
      channelHistory.set(channelId, new ChatHistoryManager());
    }
        if (IS_CONSTRAINED_TO_BOT_CHANNEL) {
      const channel = (await message.channel.fetch()) as TextChannel;
      if (!BOT_CHANNELS.includes(channel.name)) {
        return message.reply(
          "Please go to bots channel, lets keep the things simple and organized"
        );
      }
    }

    const historyManager = channelHistory.get(channelId)!;

    historyManager.addMessage("user", userMessage);

    const ai = new GoogleGenAI({ apiKey: apiKey! });

    try {
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${Ai_prompt.promptText}\n\nPrevious conversation:\n${formatHistory(
                  historyManager.getHistory()
                )}\n\nNow reply to:\n"${userMessage}"`,
              },
            ],
          },
        ],
      });

      const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text ?? "Hmm... I'm not sure how to respond to that.";

      historyManager.addMessage("model", responseText);

      await message.reply(responseText);
    } catch (error) {
      console.error("Error generating AI response:", error);
      await message.reply("Something went wrong while trying to think. Try again later!");
    }
  }
}
 
setInterval(async () => {
  try {
    const res = await fetch("https://isolated-emili-spectredev-9a803c60.koyeb.app/api/api ");
    const data = await res.json();
    console.log(data);
  } catch (err) {
    console.error("Ping error:", err);
  }
}, 300000);