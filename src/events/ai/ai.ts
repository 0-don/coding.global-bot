import {
  FunctionCallingConfigMode,
  FunctionDeclaration,
  GoogleGenAI,
  Part,
  createUserContent,
} from "@google/genai";
import { error } from "console";
import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";
import { ConfigValidator } from "../../lib/config-validator";
import { GifService } from "../../lib/gif/gif.service";
import { Ai_prompt, GIF_OFF_INSTRUCTION, GIF_ON_INSTRUCTION } from "./prompt";
import { ChatHistoryManager, makeImageParts, selectModel } from "./utils";

const GIF_PROBABILITY = 0.2;

const channelHistory = new Map<string, ChatHistoryManager>();

const GOOGLE_GEN_AI = ConfigValidator.isFeatureEnabled("GEMINI_API_KEY")
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
  : null;

@Discord()
export class AiChat {
  @On()
  async messageCreate([message]: ArgsOf<"messageCreate">, client: Client) {
    if (message.author.bot) return;
    if (!ConfigValidator.isFeatureEnabled("GEMINI_API_KEY")) return;

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

    let userMsg = message.content
      .replace(mention, "")
      .replace(/^coding global/i, "")
      .trim();

    // Gather reply context only if replying to a human user
    let replyContext = "";
    let repliedImgParts: Part[] = [];

    if (message.reference) {
      try {
        const repliedMessage = await message.channel.messages.fetch(
          message.reference.messageId!
        );

        // Only process human messages, not bots
        if (!repliedMessage.author.bot) {
          const repliedUser = repliedMessage.author;

          replyContext = `\n\nUser is asking about this message from ${repliedUser.username} (${repliedUser.globalName || repliedUser.username}):\n"${repliedMessage.content}"`;

          // Handle attachments
          if (repliedMessage.attachments.size > 0) {
            const imageCount = Array.from(
              repliedMessage.attachments.values()
            ).filter((att) => att.contentType?.startsWith("image/")).length;

            if (imageCount > 0) {
              replyContext += `\n[The replied message also contained ${imageCount} image(s)]`;
              repliedImgParts = await makeImageParts(repliedMessage);
            }
          }

          // Handle stickers
          if (repliedMessage.stickers.size > 0) {
            const stickerNames = Array.from(repliedMessage.stickers.values())
              .map((sticker) => sticker.name)
              .join(", ");
            replyContext += `\n[The replied message also contained ${repliedMessage.stickers.size} sticker(s): ${stickerNames}]`;
          }
        }
      } catch (error) {
        console.error("Error fetching replied message:", error);
      }
    }

    if (
      !userMsg &&
      message.attachments.size === 0 &&
      message.stickers.size === 0 &&
      !replyContext
    )
      return message.reply("if u are pinging me u should say something :/");

    const history =
      channelHistory.get(message.channel.id) ?? new ChatHistoryManager();
    channelHistory.set(message.channel.id, history);

    const authorName = message.author.globalName || message.author.username;

    // Add current message sticker info to context if present
    let currentStickerContext = "";
    if (message.stickers.size > 0) {
      const stickerNames = Array.from(message.stickers.values())
        .map((sticker) => sticker.name)
        .join(", ");
      currentStickerContext = `\n[User also sent ${message.stickers.size} sticker(s): ${stickerNames}]`;
    }

    history.addMessage(
      "user",
      userMsg + replyContext + currentStickerContext,
      authorName
    );

    try {
      const shouldConsiderGif = Math.random() < GIF_PROBABILITY;
      const gifInstructionText = shouldConsiderGif
        ? GIF_ON_INSTRUCTION
        : GIF_OFF_INSTRUCTION;

      const finalPromptText = Ai_prompt.promptText.replace(
        "#gifInstruction#",
        gifInstructionText
      );

      const imgParts = await makeImageParts(message);
      const userParts = [
        {
          text: `${finalPromptText}\n\nHistory:\n${history.formatHistory()}\n\nNow reply:\n"${userMsg}${replyContext}${currentStickerContext}"`,
        },
        ...imgParts,
        ...repliedImgParts,
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
