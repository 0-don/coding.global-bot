import {
  extractCodeFromAttachments,
  extractImageUrls,
} from "@/shared/ai/attachment-processor";
import { CHAT_SYSTEM_PROMPT } from "@/shared/ai/system-prompt";
import { googleClient } from "@/shared/integrations/google-ai";
import { generateText, ModelMessage } from "ai";
import { Message } from "discord.js";
import { LRUCache } from "lru-cache";
import { AiContextService } from "./ai-context.service";

const channelMessages = new LRUCache<string, ModelMessage[]>({ max: 1000 });

export interface AiChatResponse {
  text: string;
  gifUrl: string | null;
}

export class AiChatService {
  static async generateResponse(
    message: Message,
    tools: Record<string, any>,
  ): Promise<AiChatResponse | null> {
    const userMsg = this.extractUserMessage(message);
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

    const userMessage = this.buildUserMessage(fullMessage, allImages);
    const messages = channelMessages.get(message.channel.id) || [];
    messages.push(userMessage);

    const result = await googleClient.executeWithRotation(async () => {
      return generateText({
        model: googleClient.getModel(),
        system: CHAT_SYSTEM_PROMPT,
        messages: [...messages],
        tools,
        maxOutputTokens: 500,
      });
    });

    if (!result) return null;

    const { text, steps } = result;
    const responseText = text?.trim() || "";

    const history = channelMessages.get(message.channel.id) || [];
    history.push(userMessage, { role: "assistant", content: responseText });
    channelMessages.set(message.channel.id, history);

    return {
      text: responseText,
      gifUrl: this.extractGifFromSteps(steps),
    };
  }

  private static extractUserMessage(message: Message): string {
    const mentionPattern = new RegExp(`^<@!?\\d+>\\s*`);
    const codingGlobalPattern = /^coding\s?global/i;

    return message.content
      .replace(mentionPattern, "")
      .replace(codingGlobalPattern, "")
      .trim();
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
