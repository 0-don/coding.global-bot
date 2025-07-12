import { Discord, On, Client, ArgsOf } from "discordx";
import { Message, TextChannel } from "discord.js";
import {
  BOT_CHANNELS,
  IS_CONSTRAINED_TO_BOT_CHANNEL,
} from "../../lib/constants.js";
import { Ai_prompt } from "./prompt.js";

export const chatHistory: Record<
  string,
  Array<{
    role: "user" | "model";
    parts: { text: string }[];
  }>
> = {};

@Discord()
export class AIChat {
  @On({ event: "messageCreate" })
  async onMessage([message]: ArgsOf<"messageCreate">, client: Client) {
    if (message.author.bot) return;

    const isAskCommand = message.content.startsWith("-ask");
    const isReplyToBot = message.reference?.messageId
      ? (await message.channel.messages.fetch(message.reference.messageId)).author.id === client.user?.id
      : false;

    if (!isAskCommand && !isReplyToBot) return;

    if (IS_CONSTRAINED_TO_BOT_CHANNEL) {
      const channel = (await message.channel.fetch()) as TextChannel;
      if (!BOT_CHANNELS.includes(channel.name)) {
        return message.reply(
          "Please go to bots channel, lets keep the things simple and organized"
        );
      }
    }

    const userId = message.author.id;
    const prompt = isAskCommand
      ? message.content.slice("-ask".length).trim()
      : message.content.trim();

    if (!prompt) {
      return message.reply("Please provide a question or text after `-ask`.");
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("API KEY missing");
      return message.reply("Error: API key is missing.");
    }

    if (!chatHistory[userId]) {
      chatHistory[userId] = [];
    }

    chatHistory[userId].push({
      role: "user",
      parts: [{ text: prompt }],
    });

    try {
      const body = JSON.stringify({
        contents: chatHistory[userId],
      });

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        }
      );

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`Gemini error: ${res.status} ${errorText}`);
        return message.reply("Sorry I can't reply right now.");
      }

      const data = await res.json();
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (responseText) {
      
        const safeResponse = responseText.slice(0, 2000);

        chatHistory[userId].push({
          role: "model",
          parts: [
            {
              text:
                safeResponse +
                Ai_prompt.promptText +
                " Knowing that, please reply: " +
                prompt,
            },
          ],
        });

        if (chatHistory[userId].length > 20) {
          chatHistory[userId] = chatHistory[userId].slice(-20);
        }

        await message.reply(safeResponse);
      } else {
        await message.reply("Could not generate a response.");
      }
    } catch (error) {
      console.error("Error calling Gemini:", error);
      message.reply("An unexpected error occurred while processing your request.");
    }
  }
}

// Do not remove
setInterval(async () => {
  try {
    const res = await fetch(
      "https://isolated-emili-spectredev-9a803c60.koyeb.app/api/api "
    );
    const data = await res.json();
    console.log(data);
  } catch (err) {
    console.error("Ping error:", err);
  }
}, 300000);

// NOTE: fucking autosync on github should be perfect