import { Part, createPartFromUri } from "@google/genai";
import { Message } from "discord.js";
import { GOOGLE_GEN_AI } from "../../gemini";

export interface ChatMessage {
  role: "user" | "model";
  parts: { text: string }[];
  author?: string;
}

export class ChatHistoryManager {
  private history: ChatMessage[] = [];
  private maxMessages = 20;

  addMessage(role: "user" | "model", text: string, author?: string) {
    this.history.push({
      role,
      parts: [{ text }],
      author,
    });
    if (this.history.length > this.maxMessages) {
      this.history.shift();
    }
  }

  formatHistory() {
    return this.history
      .map((m) => {
        if (m.role === "user" && m.author) {
          return `${m.author}: ${m.parts[0].text}`;
        }
        return `Bot: ${m.parts[0].text}`;
      })
      .join("\n");
  }
}


export function selectModel(msg: Message) {
  for (const att of msg.attachments.values()) {
    if (att.contentType?.includes("gif") || att.url.endsWith(".gif"))
      return "gemini-1.5-flash";
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
  return parts;
}
