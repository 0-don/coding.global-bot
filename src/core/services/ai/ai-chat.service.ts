import {
  extractCodeFromAttachments,
  extractImageUrls,
} from "@/shared/ai/attachment-processor";
import { CHAT_SYSTEM_PROMPT } from "@/shared/ai/prompts";
import { googleClient, ImageDownloadError } from "@/shared/integrations/google-ai";
import { botLogger } from "@/lib/telemetry";
import { generateText, ModelMessage, stepCountIs } from "ai";
import { Message } from "discord.js";
import { LRUCache } from "lru-cache";
import { AiContextService } from "./ai-context.service";
import type { AiChatResponse } from "@/types";

const channelMessages = new LRUCache<string, ModelMessage[]>({
  max: 1000,
  dispose: (_, channelId) => channelSummaries.delete(channelId),
});
const channelSummaries = new LRUCache<string, string>({ max: 1000 });

// Number of recent messages kept verbatim before the older tail is compacted
// into a running summary. Configurable via AI_SUMMARY_WINDOW (default 50).
// Set to 0 to disable summarization entirely.
const SUMMARY_WINDOW = (() => {
  const parsed = Number(process.env.AI_SUMMARY_WINDOW);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 50;
})();

const SUMMARY_SYSTEM_PROMPT = `You are condensing a Discord chat history into a concise running summary.
Rules:
- User messages are prefixed with [Name]: — preserve these prefixes exactly so it is clear who said what.
- Bot (assistant) messages have NO prefix — represent them as the bot's own responses.
- Keep it concise but retain key facts, questions, decisions, and who said them.
- Do not invent information not present in the messages.`;

export class AiChatService {
  static async generateResponse(
    message: Message,
    tools: Record<string, any>,
  ): Promise<AiChatResponse | null> {
    const userMsg = `[${message.author.displayName}]: ${this.extractUserMessage(message)}`;
    const { replyContext, repliedImages } =
      await AiContextService.getReplyContext(message);

    let attachmentContext = "";
    if (message.attachments.size > 0) {
      const codeContent = await extractCodeFromAttachments(message);
      if (codeContent) {
        attachmentContext = `\n\n[Code from attachment]:\n${codeContent}`;
      }
    }

    const userContext = await AiContextService.getUserContext(
      message.author.id,
      message,
    );
    const fullMessage = `${userMsg}${attachmentContext}${replyContext}${userContext}`;

    const messageImages = await extractImageUrls(message);
    const allImages = [...messageImages, ...repliedImages];

    let userMessage = this.buildUserMessage(fullMessage, allImages);
    const messages = channelMessages.get(message.channel.id) || [];
    messages.push(userMessage);

    // Compact older history into a running summary once it exceeds the window.
    await this.compactHistory(message.channel.id, messages);

    const summary = channelSummaries.get(message.channel.id);
    const contextMessages: ModelMessage[] = summary
      ? [
          {
            role: "system",
            content: `Previous conversation summary:\n${summary}`,
          },
          ...messages,
        ]
      : [...messages];

    const runAI = async () => {
      return googleClient.executeWithRotation(async (model) => {
        return generateText({
          model,
          system: CHAT_SYSTEM_PROMPT,
          messages: contextMessages,
          tools,
          stopWhen: stepCountIs(3),
          maxOutputTokens: 1024,
          maxRetries: 0,
        });
      });
    };

    let result;
    try {
      result = await runAI();
    } catch (error) {
      if (error instanceof ImageDownloadError) {
        botLogger.warn("Retrying AI request without images");
        userMessage = this.buildUserMessage(fullMessage, []);
        for (let i = 0; i < messages.length; i++) {
          messages[i] = this.stripImagesFromMessage(messages[i]);
        }
        messages[messages.length - 1] = userMessage;
        result = await runAI();
      } else {
        throw error;
      }
    }

    if (!result) {
      botLogger.warn("AI returned null result");
      return null;
    }

    const { text, steps } = result;
    const responseText = this.stripFakeGifUrls(text?.trim() || "");

    botLogger.info("AI response", {
      hasText: !!responseText,
      textLength: responseText.length,
      hasSteps: !!steps?.length,
    });

    messages.push({ role: "assistant", content: responseText });
    channelMessages.set(message.channel.id, messages);

    return {
      text: responseText,
      gifUrl: this.extractGifFromSteps(steps),
    };
  }

  private static extractUserMessage(message: Message): string {
    const mentionPattern = new RegExp(`^<@[!&]?\\d+>\\s*`);
    const codingGlobalPattern = /^coding\s?global/i;

    return message.content
      .replace(mentionPattern, "")
      .replace(codingGlobalPattern, "")
      .trim();
  }

  private static async compactHistory(
    channelId: string,
    messages: ModelMessage[],
  ): Promise<void> {
    if (messages.length <= SUMMARY_WINDOW) return;

    const tail = messages.slice(0, messages.length - SUMMARY_WINDOW);
    const kept = messages.slice(messages.length - SUMMARY_WINDOW);
    const previousSummary = channelSummaries.get(channelId);

    const tailText = tail
      .map((msg) => {
        const content = Array.isArray(msg.content)
          ? msg.content
              .filter(
                (p): p is { type: "text"; text: string } =>
                  p.type === "text",
              )
              .map((p) => p.text)
              .join(" ")
          : msg.content;
        const prefix =
          msg.role === "assistant" ? "[Bot]: " : "";
        return `${prefix}${content}`;
      })
      .join("\n");

    const existingSummaryLine = previousSummary
      ? `Existing summary:\n${previousSummary}\n\n`
      : "";

    try {
      const result = await googleClient.executeWithRotation(async (model) =>
        generateText({
          model,
          system: SUMMARY_SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: `${existingSummaryLine}New messages to incorporate:\n${tailText}\n\nReturn the updated, concise running summary.`,
            },
          ],
          maxOutputTokens: 1024,
          maxRetries: 0,
        }),
      );

      const updated = result?.text?.trim();
      if (updated) {
        channelSummaries.set(channelId, updated);
        // Replace the full history with just the recent window.
        messages.length = 0;
        messages.push(...kept);
        channelMessages.set(channelId, messages);
      }
    } catch (error) {
      botLogger.error("Failed to compact chat history", {
        error: String(error),
      });
    }
  }

  private static buildUserMessage(
    text: string,
    images: string[],
  ): ModelMessage {
    if (images.length > 0) {
      return {
        role: "user",
        content: [
          { type: "text", text },
          ...images.map((url) => ({
            type: "image" as const,
            image: url,
          })),
        ],
      };
    }
    return { role: "user", content: text };
  }

  private static stripImagesFromMessage(msg: ModelMessage): ModelMessage {
    if (Array.isArray(msg.content)) {
      const filtered = (msg.content as any[]).filter(
        (part) => part.type !== "image",
      );
      if (filtered.length === 0) return { role: "user", content: "" };
      if (filtered.length === 1 && filtered[0].type === "text") {
        return { role: "user", content: filtered[0].text } as ModelMessage;
      }
      return { role: "user", content: filtered } as ModelMessage;
    }
    return msg;
  }

  private static stripFakeGifUrls(text: string): string {
    // Strip hallucinated GIF URLs and broken markdown images from models that can't use tools
    let cleaned = text
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/https?:\/\/media\.tenor\.com\/[^\s)>\]]+/gi, "")
      .replace(/https?:\/\/[^\s)>\]]*klipy\.com\/[^\s)>\]]+/gi, "")
      .replace(/https?:\/\/[^\s)>\]]*giphy\.[^\s)>\]]+/gi, "")
      .replace(/https?:\/\/[^\s)>\]]*\.gif(?:\?[^\s)>\]]*)?/gi, "");

    // Strip hallucinated structured JSON blocks some models emit instead of using the tool
    // e.g. {"text": "...", "gif": "searchMemeGifs query: ..."} or multiline variants
    cleaned = cleaned.replace(
      /\{\s*"text"\s*:\s*"[^"]*"\s*,\s*"gif"\s*:\s*"[^"]*"\s*\}/gs,
      "",
    );

    // If the entire response was a JSON wrapper, try to extract meaningful text from it
    const jsonWrapper = text.match(
      /^\s*\{\s*"text"\s*:\s*"([^"]*)"\s*,\s*"gif"\s*:\s*"[^"]*"\s*\}\s*$/s,
    );
    if (jsonWrapper && !cleaned.trim()) {
      cleaned = jsonWrapper[1];
    }

    return cleaned.replace(/\n{3,}/g, "\n\n").trim();
  }

  private static extractGifFromSteps(steps: any[]): string | null {
    if (!steps?.length) return null;

    for (const step of steps) {
      const gifResult = step.toolResults?.find(
        (result: any) => result.toolName === "searchMemeGifs",
      );
      if (gifResult?.output?.success && gifResult.output.gifUrl) {
        return gifResult.output.gifUrl;
      }
    }
    return null;
  }
}
