import { AiChatService } from "@/core/services/ai/ai-chat.service";
import { AI_TOOLS, CODING_GLOBAL_PATTERN } from "@/shared/ai/ai-tools";
import { ConfigValidator } from "@/shared/config/validator";
import { error } from "console";
import { Message, MessageFlags, TextChannel } from "discord.js";
import type { Client } from "discordx";

export async function handleAiChatMessage(
  message: Message,
  client: Client,
): Promise<void> {
  if (!shouldRespond(message, client)) return;

  if ("sendTyping" in message.channel) {
    await message.channel.sendTyping();
  }

  if (isEmptyMessage(message)) {
    await message.reply({
      content: "if u are pinging me u should say something :/",
      flags: [MessageFlags.SuppressEmbeds],
    });
    return;
  }

  try {
    const response = await AiChatService.generateResponse(message, AI_TOOLS);

    if (!response || (!response.text && !response.gifUrl)) return;

    await message.reply({
      content: response.text || undefined,
      files: response.gifUrl
        ? [{ attachment: response.gifUrl, name: "reaction.gif" }]
        : undefined,
      allowedMentions: { users: [], roles: [] },
      flags: [MessageFlags.SuppressEmbeds],
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

function shouldRespond(message: Message, client: Client): boolean {
  if (message.author.bot) return false;
  if (!ConfigValidator.isFeatureEnabled("GOOGLE_GENERATIVE_AI_API_KEY"))
    return false;

  const mention = new RegExp(`^<@!?${client.user?.id}>`);
  const isMention = mention.test(message.content);
  const isReply = isReplyToBot(message, client);
  const isCodingGlobal = CODING_GLOBAL_PATTERN.test(
    message.content.toLowerCase(),
  );

  return isMention || isReply || isCodingGlobal;
}

function isReplyToBot(message: Message, client: Client): boolean {
  if (!message.reference) return false;
  const channel = message.channel as TextChannel;
  const referencedMessage = channel.messages.cache.get(
    message.reference.messageId!,
  );
  return referencedMessage?.author.id === client.user?.id;
}

function isEmptyMessage(message: Message): boolean {
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
