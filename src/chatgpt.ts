import crypto from "crypto";
import { Tiktoken, getEncoding } from "js-tiktoken";
import Keyv from "keyv";
import OpenAI from "openai";
import {
  ChatCompletionChunk,
  ChatCompletionCreateParamsBase,
  ChatCompletionMessageParam,
  ChatCompletionSystemMessageParam,
  ChatCompletionUserMessageParam,
} from "openai/resources/chat/completions.mjs";
import { Stream } from "openai/streaming.mjs";
import QuickLRU from "quick-lru";

class ChatGPTAPI {
  private model: ChatCompletionCreateParamsBase["model"] = "gpt-3.5-turbo";
  private systemMessage: string;
  private store: Keyv<ChatMessage>;
  private openai: OpenAI;
  private maxModelTokens: number = 4000;
  private maxResponseTokens: number = 1000;
  private tokenizer: Tiktoken = getEncoding("cl100k_base");

  constructor(opts: ChatGPTAPIOptions) {
    this.openai = new OpenAI({ apiKey: opts.apiKey });
    this.systemMessage = opts.systemMessage || "";
    this.store = new Keyv<ChatMessage, any>({
      store: new QuickLRU<string, ChatMessage>({ maxSize: 10000 }),
    });
  }

  public async *sendMessage(opts: SendMessageOptions): AsyncGenerator<ChatMessage, void, unknown> {
    const latestQuestion = this.createMessage("user", opts, opts.text);
    const newMessage = this.createMessage("assistant", opts);

    const { maxTokens, messages } = await this.buildMessages(opts.text, opts);

    for await (const chunk of await this.streamCompletion(messages, maxTokens)) {
      this.updateResultFromStream(chunk, newMessage);
      yield newMessage;
      this.storeMessages(latestQuestion, newMessage);
    }
  }

  private createMessage(role: ChatMessage["role"], opts: SendMessageOptions, text: string = ""): ChatMessage {
    return {
      id: crypto.randomUUID(),
      role,
      text,
      parentMessageId: opts?.parentMessageId || crypto.randomUUID(),
      fileLink: opts?.fileLink,
    };
  }

  private async buildMessages(
    text: string,
    opts: SendMessageOptions,
  ): Promise<{ messages: ChatCompletionMessageParam[]; maxTokens: number }> {
    let messages: Array<ChatCompletionUserMessageParam | ChatCompletionSystemMessageParam> = [];
    if (this.systemMessage) {
      messages.push({ role: "system", content: this.systemMessage });
    }

    const maxNumTokens = this.maxModelTokens - this.maxResponseTokens;
    let numTokens = 0;

    do {
      const userMessages: ChatCompletionUserMessageParam = {
        role: "user",
        content: [
          { type: "text", text },
          opts.fileLink ? { type: "image_url", image_url: { url: opts.fileLink } } : null,
        ].filter(Boolean) as ChatCompletionUserMessageParam["content"],
      };
      messages.push(userMessages);
      const prompt = this.formatPrompt(messages);
      numTokens = this.getTokenCount(prompt);

      if (numTokens > maxNumTokens || !opts.parentMessageId) break;

      const parentMessage = await this.store.get(opts.parentMessageId);
      if (!parentMessage) break;

      text = parentMessage.text;
      opts.parentMessageId = parentMessage.parentMessageId;
    } while (true);

    const maxTokens = Math.max(1, Math.min(this.maxModelTokens - numTokens, this.maxResponseTokens));
    return { messages, maxTokens };
  }

  private formatPrompt(messages: Array<ChatCompletionUserMessageParam | ChatCompletionSystemMessageParam>): string {
    return messages
      .map((message) => {
        switch (message.role) {
          case "system":
            return `Instructions:\n${message.content}`;
          case "user":
            return `User:\n${
              Array.isArray(message.content)
                ? message.content.map((p) => (p.type === "text" ? p.text : p.image_url.url)).join("")
                : message.content
            }`;
          default:
            return "";
        }
      })
      .join("\n\n");
  }

  private async streamCompletion(
    messages: ChatCompletionMessageParam[],
    max_tokens: number,
  ): Promise<Stream<ChatCompletionChunk>> {
    return this.openai.chat.completions.create({
      model: this.model,
      messages,
      max_tokens,
      stream: true,
    });
  }

  private updateResultFromStream(chunk: ChatCompletionChunk, result: ChatMessage): void {
    const choice = chunk.choices?.[0];
    if (choice?.delta?.content) {
      result.text += choice.delta.content;
      result.role = choice.delta.role;
      result.detail = chunk;
      result.id = chunk.id;
      result.delta = choice.delta;
    }
  }

  private storeMessages(latestQuestion: ChatMessage, result: ChatMessage): void {
    this.store.set(latestQuestion.id, latestQuestion);
    this.store.set(result.id, result);
  }

  private getTokenCount(text: string): number {
    return this.tokenizer.encode(text.replace(/<\|endoftext\|>/g, "")).length;
  }
}

export type Role = OpenAI.Chat.Completions.ChatCompletionChunk["choices"][0]["delta"]["role"];

export type ChatGPTAPIOptions = {
  apiKey: string;
  systemMessage?: string;
};

export type SendMessageOptions = {
  text: string;
  parentMessageId?: string;
  systemMessage?: string;
  fileLink?: string;
};

export interface ChatMessage {
  id: string;
  text: string;
  role: Role;
  delta?: OpenAI.Chat.Completions.ChatCompletionChunk["choices"][0]["delta"];
  detail?: OpenAI.Chat.Completions.ChatCompletionChunk;
  usage?: ChatUsage;
  parentMessageId?: string;
  conversationId?: string;
  fileLink?: string;
}

export interface ChatUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

const globalForPrisma = global as unknown as { api: ChatGPTAPI };

export const gpt = globalForPrisma.api || new ChatGPTAPI({ apiKey: process.env.OPEN_AI });

if (process.env.NODE_ENV !== "production") globalForPrisma.api = gpt;
