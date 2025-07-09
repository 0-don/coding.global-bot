import { Discord, On, Client, ArgsOf } from "discordx";
import { Message, TextChannel } from "discord.js";

import {
  BOT_CHANNELS,
  IS_CONSTRAINED_TO_BOT_CHANNEL,
} from "../../lib/constants.js";
import { Ai_prompt } from "./prompt.js";

@Discord()
export class AIChat {
  @On({ event: "messageCreate" })
  async onMessage([message]: ArgsOf<"messageCreate">, client: Client) {

    if (message.author.bot || !message.content.startsWith("-ask")) return;

    if (IS_CONSTRAINED_TO_BOT_CHANNEL) {
      const channel = (await message.channel.fetch()) as TextChannel;
      if (!BOT_CHANNELS.includes(channel.name)) {
        return message.reply(
          "Please go to bots channel, lets keep the things simple and organized"
        );
      }
    }

    const prompt = message.content.slice("-ask".length).trim();
    if (!prompt) {
      return message.reply("Please provide a question or text after `-ask`.");
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("API KEY missing");
      return message.reply("Error: API key is missing.");
    }

    try {
      const body = JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  Ai_prompt.promptText + " Knowing that, please reply: " + prompt,
              },
            ],
          },
        ],
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
      return message.reply(responseText || "Could not generate a response.");
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

// TOKYO WAS HERE!