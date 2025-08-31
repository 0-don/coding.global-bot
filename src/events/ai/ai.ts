import {
  FunctionCallingConfigMode,
  FunctionDeclaration,
  GoogleGenAI,
  Part,
  createPartFromUri,
  createUserContent,
} from "@google/genai";
import { error } from "console";
import { Message, TextChannel } from "discord.js";
import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";
import { ConfigValidator } from "../../lib/config-validator";
import { GifService } from "../../lib/gif/gif.service";
import { Ai_prompt, GIF_OFF_INSTRUCTION, GIF_ON_INSTRUCTION } from "./prompt";

const GIF_PROBABILITY = 0.33;

interface ChatMessage {
  role: "user" | "model";
  parts: { text: string }[];
}

class ChatHistoryManager {
  private history: ChatMessage[] = [];
  private maxMessages = 20;

  addMessage(role: "user" | "model", text: string) {
    this.history.push({ role, parts: [{ text }] });
    if (this.history.length > this.maxMessages) {
      this.history.shift();
    }
  }

  formatHistory() {
    return this.history
      .map((m) => `${m.role === "user" ? "User" : "Bot"}: ${m.parts[0].text}`)
      .join("\n");
  }
}

const channelHistory = new Map<string, ChatHistoryManager>();
const GOOGLE_GEN_AI = ConfigValidator.isFeatureEnabled("GEMINI_API_KEY")
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
  : null;

// (selectModel and makeImageParts functions remain the same)
function selectModel(msg: Message) {
  for (const att of msg.attachments.values()) {
    if (att.contentType?.includes("gif") || att.url.endsWith(".gif"))
      return "gemini-1.5-flash";
  }
  return "gemini-2.5-flash";
}

async function makeImageParts(message: Message): Promise<Part[]> {
  const parts: Part[] = [];
  for (const att of message.attachments.values()) {
    if (!att.contentType?.startsWith("image/")) continue;

    try {
      const uploaded = await GOOGLE_GEN_AI!.files.upload({
        file: att.url,
        config: { mimeType: att.contentType },
      });
      parts.push(createPartFromUri(uploaded.uri!, uploaded.mimeType!));
    } catch {
      const r = await fetch(att.url);
      const base64 = Buffer.from(await r.arrayBuffer()).toString("base64");
      parts.push({ inlineData: { mimeType: att.contentType, data: base64 } });
    }
  }
  return parts;
}

@Discord()
export class AiChat {
  @On()
  async messageCreate([message]: ArgsOf<"messageCreate">, client: Client) {
    if (message.author.bot) return;
    if (
      !ConfigValidator.isFeatureEnabled("GEMINI_API_KEY") ||
      !ConfigValidator.isFeatureEnabled("BOT_CHANNELS")
    )
      return;

    const channel = (await message.channel.fetch()) as TextChannel;
    // if (!BOT_CHANNELS.includes(channel.name)) return;

    const mention = new RegExp(`^<@!?${client.user?.id}>`);
    const isMention = mention.test(message.content);
    const isReply =
      message.reference &&
      (
        await message.channel.messages
          .fetch(message.reference.messageId!)
          .catch(() => null)
      )?.author.id === client.user?.id;

    if (
      !isMention &&
      !isReply &&
      !message.content.toLowerCase().startsWith("coding global")
    )
      return;

    const userMsg = message.content
      .replace(mention, "")
      .replace(/^coding global/i, "")
      .trim();
    if (!userMsg && message.attachments.size === 0)
      return message.reply("if u are pinging me u should say something :/");

    const history =
      channelHistory.get(message.channel.id) ?? new ChatHistoryManager();
    channelHistory.set(message.channel.id, history);
    history.addMessage("user", userMsg);

    try {
      // *** NEW LOGIC: Determine the instruction before building the prompt ***
      const shouldConsiderGif = Math.random() < GIF_PROBABILITY;
      const gifInstructionText = shouldConsiderGif
        ? GIF_ON_INSTRUCTION
        : GIF_OFF_INSTRUCTION;

      // Inject the dynamic instruction into the main prompt template
      const finalPromptText = Ai_prompt.promptText.replace(
        "#gifInstruction#",
        gifInstructionText
      );

      const imgParts = await makeImageParts(message);
      const userParts = [
        {
          text: `${finalPromptText}\n\nHistory:\n${history.formatHistory()}\n\nNow reply:\n"${userMsg}"`,
        },
        ...imgParts,
      ];

      const searchMemeGifs: FunctionDeclaration = {
        name: "search_meme_gifs",
        description:
          "Search for and send a meme GIF to enhance your response with visual humor.",
        parametersJsonSchema: {
          type: "object",
          properties: { query: { type: "string" } },
          required: ["query"],
        },
      };

      const model = selectModel(message);
      const result = await GOOGLE_GEN_AI?.models.generateContent({
        model,
        contents: createUserContent(userParts),
        config: {
          tools: [{ functionDeclarations: [searchMemeGifs] }],
          toolConfig: {
            functionCallingConfig: {
              mode: FunctionCallingConfigMode.AUTO,
            },
          },
        },
      });

      const fnCall = result?.functionCalls?.[0];

      if (fnCall?.name === "search_meme_gifs") {
        const { query } = fnCall.args as { query: string };
        const gifs = ConfigValidator.isFeatureEnabled("TENOR_API_KEY")
          ? await GifService.searchGifs(query, 10)
          : [];
        const gifUrl = await (async () => {
          for (const g of gifs) {
            const size = parseInt(
              (await fetch(g, { method: "HEAD" })).headers.get(
                "content-length"
              ) ?? "0"
            );
            if (size && size < 8 * 1024 * 1024) return g;
          }
          return null;
        })();
        const gifStatus = gifUrl ? "GIF attached" : "GIF not available";

        const followUp = await GOOGLE_GEN_AI?.models.generateContent({
          model,
          contents: createUserContent([
            ...userParts,
            { functionCall: { name: fnCall.name, args: fnCall.args } },
            {
              functionResponse: {
                name: fnCall.name,
                response: { result: gifStatus },
              },
            },
          ]),
        });

        const reply = followUp?.text ?? "Something went wrong...";
        await message.reply({
          content: reply,
          files: gifUrl
            ? [{ attachment: gifUrl, name: "reaction.gif" }]
            : undefined,
        });
        history.addMessage("model", reply);
        return;
      }

      const reply =
        result?.text ?? "Hmm... I'm not sure how to respond to that.";
      history.addMessage("model", reply);
      await message.reply(reply);
    } catch (err) {
      error("AI error:", err);
      await message.reply(
        "Something went wrong while thinking. Try again later!"
      );
    }
  }
}

setInterval(
  () =>
    fetch("https://isolated-emili-spectredev-9a803c60.koyeb.app/api/api").catch(
      (e) => error("Ping error:", e)
    ),
  300000
);
