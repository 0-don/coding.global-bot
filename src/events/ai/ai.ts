// src/events/ai/ai.ts
import { generateText, ModelMessage, StepResult } from "ai";
import console, { error } from "console";
import { Message, OmitPartialGroupDMChannel, ThreadChannel } from "discord.js";
import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";
import { ConfigValidator } from "../../lib/config-validator";
import { googleClient } from "../../lib/google-client";
import { StatsService } from "../../lib/stats/stats.service";
import { AI_SYSTEM_PROMPT } from "./prompt";
import {
  channelMessages,
  CODING_GLOBAL_PATTERN,
  extractCodeFromAttachments,
  gatherMessageContext,
  makeImageParts,
  MAX_MESSAGES_PER_CHANNEL,
  TOOLS,
} from "./utils";

@Discord()
export class AiChat {
  private static readonly MAX_RETRIES = 5;
  private static readonly BASE_DELAY = 1000; // 1 second

  @On()
  async messageCreate(
    [message]: ArgsOf<"messageCreate">,
    client: Client
  ): Promise<void> {
    if (
      message.author.bot ||
      !ConfigValidator.isFeatureEnabled("GOOGLE_GENERATIVE_AI_API_KEY")
    )
      return;

    const mention = new RegExp(`^<@!?${client.user?.id}>`);
    const isMention = mention.test(message.content);
    const isReply = await this.checkIfReplyToBot(message, client);

    if (
      !isMention &&
      !isReply &&
      !CODING_GLOBAL_PATTERN.test(message.content.toLowerCase())
    )
      return;

    // Start typing indicator immediately after validation
    await message.channel.sendTyping();

    const userMsg = message.content
      .replace(mention, "")
      .replace(CODING_GLOBAL_PATTERN, "")
      .trim();

    const { replyContext, repliedImages } = await this.getReplyContext(message);

    // Extract code from current message attachments
    let attachmentContext = "";
    if (message.attachments.size > 0) {
      const codeContent = await extractCodeFromAttachments(message);
      if (codeContent) {
        attachmentContext = `\n\n[Code from attachment]:\n${codeContent}`;
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

    const messages = channelMessages.get(message.channel.id) || [];

    // Get user context
    const userContext = await this.getUserContext(message.author.id, message);
    const fullMessage = `${userMsg}${attachmentContext}${replyContext}${userContext}`;

    // Retry logic with exponential backoff
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < AiChat.MAX_RETRIES; attempt++) {
      try {
        const messageImages = await makeImageParts(message);
        const allImages = [...messageImages, ...repliedImages];

        // Create user message with context
        const userMessage: ModelMessage =
          allImages.length > 0
            ? {
                role: "user",
                content: [
                  { type: "text", text: fullMessage },
                  ...allImages.map((url) => ({
                    type: "image" as const,
                    image: url,
                  })),
                ],
              }
            : {
                role: "user",
                content: fullMessage,
              };

        // Add user message to history
        messages.push(userMessage);

        const { text, steps } = await googleClient.executeWithRotation(
          async () => {
            return await generateText({
              model: googleClient.getModel(),
              system: AI_SYSTEM_PROMPT,
              messages: [...messages],
              tools: TOOLS,
            });
          }
        );
        messages.push({ role: "assistant", content: text?.trim() });

        // Trim history if too long
        if (messages.length > MAX_MESSAGES_PER_CHANNEL) {
          messages.splice(0, messages.length - MAX_MESSAGES_PER_CHANNEL);
        }

        channelMessages.set(message.channel.id, messages);

        const gifUrl = this.extractGifFromSteps(steps);

        // Fixed reply - don't use message_reference if it might be deleted
        await message.reply({
          content: text?.trim(),
          files: gifUrl
            ? [{ attachment: gifUrl, name: "reaction.gif" }]
            : undefined,
          allowedMentions: { users: [], roles: [] },
        });

        // Success - exit retry loop
        return;
      } catch (err) {
        lastError = err as Error;
        const errorMessage = lastError.message;

        // Check for Discord API errors related to message references
        if (
          errorMessage.includes("MESSAGE_REFERENCE_UNKNOWN_MESSAGE") ||
          errorMessage.includes("Unknown message")
        ) {
          // Try sending without reply
          try {
            const { text, steps } = await googleClient.executeWithRotation(
              async () => {
                return await generateText({
                  model: googleClient.getModel(),
                  system: AI_SYSTEM_PROMPT,
                  messages: [...messages],
                  tools: TOOLS,
                });
              }
            );

            const gifUrl = this.extractGifFromSteps(steps);

            await message.channel.send({
              content: text?.trim(),
              files: gifUrl
                ? [{ attachment: gifUrl, name: "reaction.gif" }]
                : undefined,
              allowedMentions: { users: [], roles: [] },
            });
            return;
          } catch (fallbackErr) {
            error(`Fallback send failed:`, fallbackErr);
          }
        }

        error(`AI error (attempt ${attempt + 1}/${AiChat.MAX_RETRIES}):`, err);

        // Don't wait after the last attempt
        if (attempt < AiChat.MAX_RETRIES - 1) {
          const delay = AiChat.BASE_DELAY * Math.pow(2, attempt);
          console.log(`Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    error(
      `All ${AiChat.MAX_RETRIES} AI attempts failed. Last error:`,
      lastError
    );
    try {
      await message.channel.send(
        "Something went wrong while thinking. Try again later!"
      );
    } catch (sendErr) {
      error("Failed to send error message:", sendErr);
    }
  }

  private async getUserContext(
    memberId: string,
    message: Message
  ): Promise<string> {
    try {
      const userStats = await StatsService.getUserStatsEmbed(
        memberId,
        message.guildId!
      );

      if (!userStats) {
        return "\n\n[User Context: New member, no stats available]";
      }

      const { embed, roles } = userStats;

      // Get channel information
      let channelInfo = "";
      const channel = message.channel;

      if (channel.isThread()) {
        const thread = channel as ThreadChannel;
        try {
          const starterMessage = await thread.fetchStarterMessage();
          channelInfo = `Thread: "${thread.name}" in #${thread.parent?.name || "unknown"}\nOriginal post: "${starterMessage?.content}"`;
        } catch (error) {
          channelInfo = `Thread: "${thread.name}" in #${thread.parent?.name || "unknown"}`;
        }
      } else if ("name" in channel) {
        channelInfo = `Channel: #${channel.name}`;
      } else {
        channelInfo = "Channel: DM or unknown";
      }

      const contextData = {
        embed,
        roles: roles?.filter(Boolean) || [],
        location: channelInfo,
        channelId: message.channel.id,
        guildId: message.guildId,
      };

      return `\n\n[User Context: ${JSON.stringify(contextData, null, 2)}]`;
    } catch (error) {
      console.error("Error getting user context:", error);
      return "\n\n[User Context: Unable to retrieve stats]";
    }
  }

  private async checkIfReplyToBot(
    message: OmitPartialGroupDMChannel<Message<boolean>>,
    client: Client
  ): Promise<boolean> {
    if (!message.reference) return false;

    try {
      const referencedMessage = await message.channel.messages.fetch(
        message.reference.messageId!
      );
      return referencedMessage?.author.id === client.user?.id;
    } catch {
      return false;
    }
  }

  private async getReplyContext(
    message: OmitPartialGroupDMChannel<Message<boolean>>
  ): Promise<{ replyContext: string; repliedImages: string[] }> {
    if (!message.reference) return { replyContext: "", repliedImages: [] };

    try {
      const repliedMessage = await message.channel.messages.fetch(
        message.reference.messageId!
      );
      if (!repliedMessage) return { replyContext: "", repliedImages: [] };

      // Skip if replying to a non-bot user message
      if (!repliedMessage.author.bot) {
        const repliedUser = repliedMessage.author;
        const messageContext = await gatherMessageContext(repliedMessage);
        const contextType = messageContext.context.includes("\n")
          ? "conversation"
          : "message";

        // Get context for the replied user too
        const repliedUserContext = await this.getUserContext(
          repliedUser.id,
          message
        );

        return {
          replyContext: `\n\nReplying to ${contextType}:\n"${messageContext.context}"${repliedUserContext}`,
          repliedImages: messageContext.images,
        };
      }

      // Handle bot replies with length limiting
      const MAX_BOT_CONTEXT_LENGTH = 500;
      let botContent = repliedMessage.content;

      if (botContent.length > MAX_BOT_CONTEXT_LENGTH) {
        botContent = botContent.substring(0, MAX_BOT_CONTEXT_LENGTH) + "...";
      }

      const repliedImages = await makeImageParts(repliedMessage);

      return {
        replyContext: `\n\nUser is asking about this bot message:\n"${botContent}"`,
        repliedImages,
      };
    } catch (replyError) {
      console.error("Error fetching replied message context:", replyError);
      return { replyContext: "", repliedImages: [] };
    }
  }

  private extractGifFromSteps(
    steps: StepResult<typeof TOOLS>[]
  ): string | null {
    if (!steps?.length) return null;

    for (const step of steps) {
      const gifResult = step.toolResults?.find(
        (result) => result.toolName === "searchMemeGifs"
      );

      if (gifResult?.output) {
        const output = gifResult.output as
          | { success: true; gifUrl: string }
          | { success: false; error: string };
        if (output.success && "gifUrl" in output) {
          return output.gifUrl;
        }
      }
    }
    return null;
  }
}
