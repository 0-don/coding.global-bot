import { AiChatService } from "@/core/services/ai/ai-chat.service";
import { AI_TOOLS, CODING_GLOBAL_PATTERN } from "@/shared/ai/ai-tools";
import { ConfigValidator } from "@/shared/config/validator";
import { error } from "console";
import { Message, TextChannel } from "discord.js";
import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";

@Discord()
export class AiChat {
  @On()
  async messageCreate(
    [message]: ArgsOf<"messageCreate">,
    client: Client,
  ): Promise<void> {
    if (!this.shouldRespond(message, client)) return;
    console.log("AI Chat message received");
    await message.channel.sendTyping();

    if (this.isEmptyMessage(message)) {
      await message.reply("if u are pinging me u should say something :/");
      return;
    }

    try {
      const response = await AiChatService.generateResponse(message, AI_TOOLS);

      if (!response) return;

      await message.reply({
        content: response.text,
        files: response.gifUrl
          ? [{ attachment: response.gifUrl, name: "reaction.gif" }]
          : undefined,
        allowedMentions: { users: [], roles: [] },
      });
    } catch (err) {
      const errorMessage = (err as Error).message;

      if (
        errorMessage.includes("MESSAGE_REFERENCE_UNKNOWN_MESSAGE") ||
        errorMessage.includes("Unknown message")
      ) {
        return;
      }

      error("AI chat error:", err);
    }
  }

  private shouldRespond(message: Message, client: Client): boolean {
    if (message.author.bot) return false;
    if (!ConfigValidator.isFeatureEnabled("GOOGLE_GENERATIVE_AI_API_KEY"))
      return false;

    const mention = new RegExp(`^<@!?${client.user?.id}>`);
    const isMention = mention.test(message.content);
    const isReply = this.isReplyToBot(message, client);
    const isCodingGlobal = CODING_GLOBAL_PATTERN.test(
      message.content.toLowerCase(),
    );

    return isMention || isReply || isCodingGlobal;
  }

  private isReplyToBot(message: Message, client: Client): boolean {
    if (!message.reference) return false;
    const channel = message.channel as TextChannel;
    const referencedMessage = channel.messages.cache.get(
      message.reference.messageId!,
    );
    return referencedMessage?.author.id === client.user?.id;
  }

  private isEmptyMessage(message: Message): boolean {
    const mention = new RegExp(`^<@!?\\d+>\\s*`);
    const userMsg = message.content
      .replace(mention, "")
      .replace(CODING_GLOBAL_PATTERN, "")
      .trim();

    return (
      !userMsg &&
      message.attachments.size === 0 &&
      message.stickers.size === 0 &&
      !message.reference
    );
  }
}
