import { Part, createPartFromUri } from "@google/genai";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import {
  Collection,
  DMChannel,
  Message,
  NewsChannel,
  StickerFormatType,
  TextChannel,
  ThreadChannel,
} from "discord.js";
import { GOOGLE_GEN_AI } from "../../gemini";

dayjs.extend(relativeTime);

export interface ChatMessage {
  role: "user" | "model";
  parts: { text: string }[];
  author?: string;
  timestamp: Date;
}

export class ChatHistoryManager {
  private history: ChatMessage[] = [];
  private maxMessages = 20;

  addMessage(role: "user" | "model", text: string, author?: string) {
    this.history.push({
      role,
      parts: [{ text }],
      author,
      timestamp: new Date(),
    });
    if (this.history.length > this.maxMessages) {
      this.history.shift();
    }
  }

  formatHistory() {
    return this.history
      .map((m) => {
        const timeAgo = dayjs(m.timestamp).fromNow();

        if (m.role === "user" && m.author) {
          return `[${timeAgo}] ${m.author}: ${m.parts[0].text}`;
        }
        return `[${timeAgo}] Bot: ${m.parts[0].text}`;
      })
      .join("\n");
  }
}

export async function gatherMessageContext(repliedMessage: Message<boolean>) {
  const userId = repliedMessage.author.id;
  const channel = repliedMessage.channel as
    | TextChannel
    | DMChannel
    | NewsChannel
    | ThreadChannel;
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

export function selectModel(parts: Part[]): string {
  // Check for any GIF content in the parts
  for (const part of parts) {
    if (part.inlineData?.mimeType === "image/gif") {
      return "gemini-1.5-flash";
    }
  }

  return "gemini-2.5-flash";
}

export async function makeImageParts(message: Message): Promise<Part[]> {
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

  for (const sticker of message.stickers.values()) {
    if (sticker.format === StickerFormatType.Lottie) continue;

    try {
      const stickerUrl = sticker.url;
      let mimeType: string;

      if (sticker.format === StickerFormatType.PNG) {
        mimeType = "image/png";
      } else if (sticker.format === StickerFormatType.APNG) {
        mimeType = "image/png";
      } else if (sticker.format === StickerFormatType.GIF) {
        mimeType = "image/gif";
      } else {
        mimeType = "image/png"; // fallback
      }

      try {
        const uploaded = await GOOGLE_GEN_AI!.files.upload({
          file: stickerUrl,
          config: { mimeType },
        });
        parts.push(createPartFromUri(uploaded.uri!, uploaded.mimeType!));
      } catch {
        const r = await fetch(stickerUrl);
        const base64 = Buffer.from(await r.arrayBuffer()).toString("base64");
        parts.push({ inlineData: { mimeType, data: base64 } });
      }
    } catch (error) {
      console.error("Error processing sticker:", error);
    }
  }

  return parts;
}
