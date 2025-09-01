// src/events/ai/ai.ts
import {
  FunctionCallingConfigMode,
  FunctionDeclaration,
  GoogleGenAI,
  Part,
  createUserContent,
} from "@google/genai";
import { error } from "console";
import {
  Collection,
  DMChannel,
  Message,
  NewsChannel,
  TextChannel,
  ThreadChannel,
} from "discord.js";
import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";
import { ConfigValidator } from "../../lib/config-validator";
import { GifService } from "../../lib/gif/gif.service";
import {
  AI_SYSTEM_PROMPT,
  GIF_OFF_INSTRUCTION,
  GIF_ON_INSTRUCTION,
} from "./prompt";
import { ChatHistoryManager, makeImageParts, selectModel } from "./utils";

const GIF_PROBABILITY = 0.2;

const channelHistory = new Map<string, ChatHistoryManager>();

const GOOGLE_GEN_AI = ConfigValidator.isFeatureEnabled("GEMINI_API_KEY")
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
  : null;

type MessageChannel = TextChannel | DMChannel | NewsChannel | ThreadChannel;

interface MessageContext {
  context: string;
  imageParts: Part[];
}

// New function to gather contextual messages with full TypeScript typing
async function gatherMessageContext(
  repliedMessage: Message<boolean>,
  channel: MessageChannel
): Promise<MessageContext> {
  const userId: string = repliedMessage.author.id;
  const imageParts: Part[] = [];

  try {
    // Fetch recent messages before the replied message
    const recentMessages: Collection<
      string,
      Message<boolean>
    > = await channel.messages.fetch({
      limit: 50,
      before: repliedMessage.id,
    });

    // Fetch recent messages after the replied message
    const afterMessages: Collection<
      string,
      Message<boolean>
    > = await channel.messages.fetch({
      limit: 50,
      after: repliedMessage.id,
    });

    // Convert to arrays and filter for same user, non-bot messages
    const beforeArray: Message<boolean>[] = Array.from(recentMessages.values())
      .filter(
        (msg: Message<boolean>): boolean =>
          msg.author.id === userId && !msg.author.bot
      )
      .sort(
        (a: Message<boolean>, b: Message<boolean>): number =>
          a.createdTimestamp - b.createdTimestamp
      );

    const afterArray: Message<boolean>[] = Array.from(afterMessages.values())
      .filter(
        (msg: Message<boolean>): boolean =>
          msg.author.id === userId && !msg.author.bot
      )
      .sort(
        (a: Message<boolean>, b: Message<boolean>): number =>
          a.createdTimestamp - b.createdTimestamp
      );

    // Find consecutive messages before the replied message
    const messagesBefore: Message<boolean>[] = [];
    for (let i = beforeArray.length - 1; i >= 0; i--) {
      const msg: Message<boolean> = beforeArray[i]!;
      if (msg.author.id === userId) {
        messagesBefore.unshift(msg); // Add to beginning to maintain order
      } else {
        break; // Stop when we hit a different user
      }
    }

    // Find consecutive messages after the replied message
    const messagesAfter: Message<boolean>[] = [];
    for (const msg of afterArray) {
      if (msg.author.id === userId) {
        messagesAfter.push(msg);
      } else {
        break; // Stop when we hit a different user
      }
    }

    // Combine all messages in chronological order
    const allMessages: Message<boolean>[] = [
      ...messagesBefore,
      repliedMessage,
      ...messagesAfter,
    ];

    // Build context string and collect images
    const contextParts: string[] = [];

    for (const msg of allMessages) {
      let msgContent: string = msg.content || "";

      // Handle attachments
      if (msg.attachments.size > 0) {
        const imageAttachments = Array.from(msg.attachments.values()).filter(
          (att) => att.contentType?.startsWith("image/")
        );

        const imageCount: number = imageAttachments.length;

        if (imageCount > 0) {
          msgContent += ` [${imageCount} image(s) attached]`;
          // Collect image parts for AI processing
          try {
            const msgImageParts: Part[] = await makeImageParts(msg);
            imageParts.push(...msgImageParts);
          } catch (imgError) {
            console.error("Error processing images:", imgError);
          }
        }
      }

      // Handle stickers
      if (msg.stickers.size > 0) {
        const stickerNames: string = Array.from(msg.stickers.values())
          .map((sticker) => sticker.name)
          .join(", ");
        msgContent += ` [Sticker(s): ${stickerNames}]`;
      }

      if (msgContent.trim()) {
        contextParts.push(msgContent);
      }
    }

    const context: string =
      contextParts.length > 1 ? contextParts.join("\n") : contextParts[0] || "";

    return { context, imageParts };
  } catch (fetchError) {
    console.error("Error fetching message context:", fetchError);
    return { context: repliedMessage.content || "", imageParts: [] };
  }
}

@Discord()
export class AiChat {
  @On()
  async messageCreate(
    [message]: ArgsOf<"messageCreate">,
    client: Client
  ): Promise<void> {
    if (message.author.bot) return;
    if (!ConfigValidator.isFeatureEnabled("GEMINI_API_KEY")) return;

    const mention: RegExp = new RegExp(`^<@!?${client.user?.id}>`);
    const isMention: boolean = mention.test(message.content);

    let isReply: boolean = false;
    if (message.reference) {
      try {
        const referencedMessage: Message<boolean> | null =
          await message.channel.messages
            .fetch(message.reference.messageId!)
            .catch((): null => null);
        isReply = referencedMessage?.author.id === client.user?.id;
      } catch {
        isReply = false;
      }
    }

    if (
      !isMention &&
      !isReply &&
      !message.content.toLowerCase().startsWith("coding global")
    )
      return;

    let userMsg: string = message.content
      .replace(mention, "")
      .replace(/^coding global/i, "")
      .trim();

    // Gather reply context with extended message collection
    let replyContext: string = "";
    let repliedImgParts: Part[] = [];

    if (message.reference) {
      try {
        const repliedMessage: Message<boolean> | null =
          await message.channel.messages.fetch(message.reference.messageId!);

        // Only process human messages, not bots
        if (repliedMessage && !repliedMessage.author.bot) {
          const repliedUser = repliedMessage.author;

          // Get extended context for the user's messages
          const messageContext: MessageContext = await gatherMessageContext(
            repliedMessage,
            message.channel as MessageChannel
          );

          repliedImgParts = messageContext.imageParts;

          if (messageContext.context.includes("\n")) {
            // Multiple messages - show as conversation
            replyContext = `\n\nUser is asking about this conversation from ${repliedUser.username} (${repliedUser.globalName || repliedUser.username}):\n"${messageContext.context}"`;
          } else {
            // Single message - use original format
            replyContext = `\n\nUser is asking about this message from ${repliedUser.username} (${repliedUser.globalName || repliedUser.username}):\n"${messageContext.context}"`;
          }
        }
      } catch (replyError) {
        console.error("Error fetching replied message context:", replyError);
      }
    }

    if (
      !userMsg &&
      message.attachments.size === 0 &&
      message.stickers.size === 0 &&
      !replyContext
    ) {
      await message.reply("if u are pinging me u should say something :/");
      return;
    }

    const history: ChatHistoryManager =
      channelHistory.get(message.channel.id) ?? new ChatHistoryManager();
    channelHistory.set(message.channel.id, history);

    const authorName: string =
      message.author.globalName || message.author.username;

    // Add current message sticker info to context if present
    let currentStickerContext: string = "";
    if (message.stickers.size > 0) {
      const stickerNames: string = Array.from(message.stickers.values())
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
      const shouldConsiderGif: boolean = Math.random() < GIF_PROBABILITY;
      const gifInstructionText: string = shouldConsiderGif
        ? GIF_ON_INSTRUCTION
        : GIF_OFF_INSTRUCTION;

      const finalPromptText: string = AI_SYSTEM_PROMPT.replace(
        "#gifInstruction#",
        gifInstructionText
      );

      const imgParts: Part[] = await makeImageParts(message);
      const userParts: Part[] = [
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

      const model: string = selectModel(message);
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
        const { query }: { query: string } = fnCall.args as { query: string };
        const gifs: string[] = ConfigValidator.isFeatureEnabled("TENOR_API_KEY")
          ? await GifService.searchGifs(query, 10)
          : [];

        const gifUrl: string | null = await (async (): Promise<
          string | null
        > => {
          for (const g of gifs) {
            const response: Response = await fetch(g, { method: "HEAD" });
            const contentLength: string | null =
              response.headers.get("content-length");
            const size: number = parseInt(contentLength ?? "0");
            if (size && size < 8 * 1024 * 1024) return g;
          }
          return null;
        })();

        const gifStatus: string = gifUrl ? "GIF attached" : "GIF not available";

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

        const reply: string = followUp?.text ?? "Something went wrong...";
        await message.reply({
          content: reply,
          files: gifUrl
            ? [{ attachment: gifUrl, name: "reaction.gif" }]
            : undefined,
        });
        history.addMessage("model", reply);
        return;
      }

      const reply: string =
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
