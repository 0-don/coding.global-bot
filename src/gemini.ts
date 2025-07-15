import { GoogleGenAI } from "@google/genai";
import crypto from "crypto";
import Keyv from "keyv";
import QuickLRU from "quick-lru";
import { ConfigValidator } from "./lib/config-validator";

class GoogleGenAIAPI {
  private model = "gemini-2.5-flash";
  private store = new Keyv<ChatMessage>({
    store: new QuickLRU<string, ChatMessage>({ maxSize: 10000 }),
  });
  private ai: GoogleGenAI;

  constructor(opts: GoogleGenAIAPIOptions) {
    this.ai = new GoogleGenAI({ apiKey: opts.apiKey });
  }

  public async sendMessage(opts: SendMessageOptions): Promise<ChatMessage> {
    const latestQuestion = this.createMessage(
      "user",
      opts.text,
      opts.parentMessageId
    );
    const history = await this.buildChatHistory(opts.parentMessageId);

    const chat = this.ai.chats.create({
      model: this.model,
      config: {
        maxOutputTokens: 1000,
        systemInstruction: opts.systemMessage,
      },
      history,
    });

    const response = await chat.sendMessage({ message: opts.text });
    const newMessage = this.createMessage(
      "model",
      response.text || "",
      latestQuestion.id
    );

    this.storeMessages(latestQuestion, newMessage);
    return newMessage;
  }

  private createMessage(
    role: Role,
    text: string,
    parentMessageId?: string | null
  ): ChatMessage {
    return {
      id: crypto.randomUUID(),
      role,
      text,
      parentMessageId: parentMessageId || undefined,
    };
  }

  private async buildChatHistory(parentMessageId?: string | null) {
    if (!parentMessageId) return [];

    const messages: ChatMessage[] = [];
    let currentId: string | undefined = parentMessageId;

    while (currentId) {
      const message: ChatMessage | undefined = await this.store.get(currentId);
      if (!message) break;
      messages.unshift(message);
      currentId = message.parentMessageId;
    }

    return messages.map((msg: ChatMessage) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.text }],
    }));
  }

  private storeMessages(question: ChatMessage, answer: ChatMessage): void {
    this.store.set(question.id, question);
    this.store.set(answer.id, answer);
  }
}

export type Role = "user" | "model";

export interface GoogleGenAIAPIOptions {
  apiKey: string;
}

export interface SendMessageOptions {
  text: string;
  parentMessageId?: string | null;
  systemMessage?: string;
}

export interface ChatMessage {
  id: string;
  text: string;
  role: Role;
  parentMessageId?: string;
}

export const GOOGLE_GEN_AI_API = ConfigValidator.isFeatureEnabled(
  "GEMINI_API_KEY"
)
  ? new GoogleGenAIAPI({
      apiKey: process.env.GEMINI_API_KEY!,
    })
  : null;

export const GOOGLE_GEN_AI = ConfigValidator.isFeatureEnabled("GEMINI_API_KEY")
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    })
  : null;
