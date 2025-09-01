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

async function gatherMessageContext(
  repliedMessage: Message<boolean>,
  channel: MessageChannel
): Promise<MessageContext> {
  const userId = repliedMessage.author.id;
  const imageParts: Part[] = [];

  try {
    const [recentMessages, afterMessages] = await Promise.all([
      channel.messages.fetch({ limit: 50, before: repliedMessage.id }),
      channel.messages.fetch({ limit: 50, after: repliedMessage.id }),
    ]);

    const filterAndSort = (messages: Collection<string, Message<boolean>>) =>
      Array.from(messages.values())
        .filter((msg) => msg.author.id === userId && !msg.author.bot)
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    const beforeArray = filterAndSort(recentMessages);
    const afterArray = filterAndSort(afterMessages);

    // Find consecutive messages before/after
    const messagesBefore: Message<boolean>[] = [];
    for (let i = beforeArray.length - 1; i >= 0; i--) {
      const msg = beforeArray[i]!;
      if (msg.author.id === userId) {
        messagesBefore.unshift(msg);
      } else break;
    }

    const messagesAfter: Message<boolean>[] = [];
    for (const msg of afterArray) {
      if (msg.author.id === userId) {
        messagesAfter.push(msg);
      } else break;
    }

    const allMessages = [...messagesBefore, repliedMessage, ...messagesAfter];
    const contextParts: string[] = [];

    for (const msg of allMessages) {
      let msgContent = msg.content || "";

      if (msg.attachments.size > 0 || msg.stickers.size > 0) {
        try {
          const msgImageParts = await makeImageParts(msg);
          imageParts.push(...msgImageParts);
        } catch (imgError) {
          console.error("Error processing images:", imgError);
        }
      }

      if (msgContent.trim()) {
        contextParts.push(msgContent);
      }
    }

    const context =
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
    if (
      message.author.bot ||
      !ConfigValidator.isFeatureEnabled("GEMINI_API_KEY")
    )
      return;

    const mention = new RegExp(`^<@!?${client.user?.id}>`);
    const isMention = mention.test(message.content);

    let isReply = false;
    if (message.reference) {
      try {
        const referencedMessage = await message.channel.messages
          .fetch(message.reference.messageId!)
          .catch(() => null);
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

    let userMsg = message.content
      .replace(mention, "")
      .replace(/^coding global/i, "")
      .trim();

    let replyContext = "";
    let repliedImgParts: Part[] = [];

    if (message.reference) {
      try {
        const repliedMessage = await message.channel.messages.fetch(
          message.reference.messageId!
        );

        if (repliedMessage && !repliedMessage.author.bot) {
          const repliedUser = repliedMessage.author;
          const messageContext = await gatherMessageContext(
            repliedMessage,
            message.channel as MessageChannel
          );

          repliedImgParts = messageContext.imageParts;
          const contextType = messageContext.context.includes("\n")
            ? "conversation"
            : "message";
          replyContext = `\n\nUser is asking about this ${contextType} from ${repliedUser.username} (${repliedUser.globalName || repliedUser.username}):\n"${messageContext.context}"`;
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

    const history =
      channelHistory.get(message.channel.id) ?? new ChatHistoryManager();
    channelHistory.set(message.channel.id, history);

    const authorName = message.author.globalName || message.author.username;
    history.addMessage("user", userMsg + replyContext, authorName);

    try {
      const shouldConsiderGif = Math.random() < GIF_PROBABILITY;
      const gifInstructionText = shouldConsiderGif
        ? GIF_ON_INSTRUCTION
        : GIF_OFF_INSTRUCTION;
      const finalPromptText = AI_SYSTEM_PROMPT.replace(
        "#gifInstruction#",
        gifInstructionText
      );

      const imgParts = await makeImageParts(message);
      const userParts: Part[] = [
        {
          text: `${finalPromptText}\n\nHistory:\n${history.formatHistory()}\n\nNow reply:\n"${userMsg}${replyContext}"`,
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
            functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO },
          },
        },
      });

      const fnCall = result?.functionCalls?.[0];

      if (fnCall?.name === "search_meme_gifs") {
        const { query } = fnCall.args as { query: string };
        const gifs = ConfigValidator.isFeatureEnabled("TENOR_API_KEY")
          ? await GifService.searchGifs(query, 10)
          : [];

        let gifUrl: string | null = null;
        for (const g of gifs) {
          const response = await fetch(g, { method: "HEAD" });
          const contentLength = response.headers.get("content-length");
          const size = parseInt(contentLength ?? "0");
          if (size && size < 8 * 1024 * 1024) {
            gifUrl = g;
            break;
          }
        }

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
