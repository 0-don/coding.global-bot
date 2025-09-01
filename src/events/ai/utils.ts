import { Part, createPartFromUri } from "@google/genai";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { Message, StickerFormatType } from "discord.js";
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
