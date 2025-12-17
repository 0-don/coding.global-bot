import { generateText, ModelMessage } from "ai";
import { error } from "console";
import { Message, ThreadChannel } from "discord.js";
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
  @On()
  async messageCreate(
    [message]: ArgsOf<"messageCreate">,
    client: Client,
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

    await message.channel.sendTyping();

    const userMsg = message.content
      .replace(mention, "")
      .replace(CODING_GLOBAL_PATTERN, "")
      .trim();
    const { replyContext, repliedImages } = await this.getReplyContext(message);

    let attachmentContext = "";
    if (message.attachments.size > 0) {
      const codeContent = await extractCodeFromAttachments(message);
      if (codeContent)
        attachmentContext = `\n\n[Code from attachment]:\n${codeContent}`;
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

    try {
      const messages = channelMessages.get(message.channel.id) || [];
      const userContext = await this.getUserContext(message.author.id, message);
      const fullMessage = `${userMsg}${attachmentContext}${replyContext}${userContext}`;

      const messageImages = await makeImageParts(message);
      const allImages = [...messageImages, ...repliedImages];

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
          : { role: "user", content: fullMessage };

      messages.push(userMessage);

      const { text, steps } = await googleClient.executeWithRotation(
        async () => {
          return await generateText({
            model: googleClient.getModel(),
            system: AI_SYSTEM_PROMPT,
            messages: [...messages],
            tools: TOOLS,
            maxOutputTokens: 500,
          });
        },
      );

      console.log('[AI Response Debug]', {
        rawText: text,
        textLength: text?.length || 0,
        trimmedLength: text?.trim().length || 0,
        hasSteps: !!steps?.length,
        stepsCount: steps?.length || 0,
        stepDetails: steps?.map(step => ({
          toolCallsCount: step.toolCalls?.length || 0,
          toolResultsCount: step.toolResults?.length || 0,
          toolNames: step.toolResults?.map((r: any) => r.toolName) || []
        }))
      });

      // Fix: Check if text is empty or only whitespace
      const responseText = text?.trim();
      if (!responseText) {
        console.warn("AI generated empty response, using fallback");
        // If there are tool results but no text, provide a default message
        const hasToolResults = steps?.some(step => step.toolResults?.length > 0);
        console.log('[Empty Response Handling]', {
          hasToolResults,
          willUseFallback: !hasToolResults
        });
        if (hasToolResults) {
          // Tool was used (like searchMemeGifs) but no text was generated
          // The GIF will still be sent below, so just add a simple message
          messages.push({ role: "assistant", content: "👍" });
        } else {
          await message.reply("sorry, something went wrong with my response...");
          return;
        }
      } else {
        console.log('[AI Response Success]', { responseLength: responseText.length });
        messages.push({ role: "assistant", content: responseText });
      }

      if (messages.length > MAX_MESSAGES_PER_CHANNEL) {
        messages.splice(0, messages.length - MAX_MESSAGES_PER_CHANNEL);
      }

      channelMessages.set(message.channel.id, messages);

      const gifUrl = this.extractGifFromSteps(steps);
      console.log('[GIF Extraction]', { gifUrl, hasGif: !!gifUrl });

      // Use responseText if available, otherwise get the last assistant message content
      let replyContent = responseText;
      if (!replyContent) {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && typeof lastMessage.content === 'string') {
          replyContent = lastMessage.content;
        } else {
          replyContent = "👍";
        }
      }

      console.log('[Reply Content]', {
        replyContent: replyContent.substring(0, 100),
        contentLength: replyContent.length,
        hasGifAttachment: !!gifUrl
      });

      await message.reply({
        content: replyContent,
        files: gifUrl
          ? [{ attachment: gifUrl, name: "reaction.gif" }]
          : undefined,
        allowedMentions: { users: [], roles: [] },
      });
    } catch (err) {
      const errorMessage = (err as Error).message;

      // Exit silently for message reference errors - original message was deleted
      if (
        errorMessage.includes("MESSAGE_REFERENCE_UNKNOWN_MESSAGE") ||
        errorMessage.includes("Unknown message")
      ) {
        return;
      }

      error("AI chat error:", err);
    }
  }

  private async checkIfReplyToBot(
    message: Message,
    client: Client,
  ): Promise<boolean> {
    if (!message.reference) return false;
    try {
      const referenced = await message.channel.messages.fetch(
        message.reference.messageId!,
      );
      return referenced?.author.id === client.user?.id;
    } catch {
      return false;
    }
  }

  private async getReplyContext(
    message: Message,
  ): Promise<{ replyContext: string; repliedImages: string[] }> {
    if (!message.reference) return { replyContext: "", repliedImages: [] };

    try {
      const repliedMessage = await message.channel.messages.fetch(
        message.reference.messageId!,
      );
      if (!repliedMessage) return { replyContext: "", repliedImages: [] };

      if (!repliedMessage.author.bot) {
        const messageContext = await gatherMessageContext(repliedMessage);
        const contextType = messageContext.context.includes("\n")
          ? "conversation"
          : "message";
        const repliedUserContext = await this.getUserContext(
          repliedMessage.author.id,
          message,
        );

        return {
          replyContext: `\n\nReplying to ${contextType}:\n"${messageContext.context}"${repliedUserContext}`,
          repliedImages: messageContext.images,
        };
      }

      const botContent =
        repliedMessage.content.length > 500
          ? repliedMessage.content.substring(0, 500) + "..."
          : repliedMessage.content;

      return {
        replyContext: `\n\nUser is asking about this bot message:\n"${botContent}"`,
        repliedImages: await makeImageParts(repliedMessage),
      };
    } catch {
      return { replyContext: "", repliedImages: [] };
    }
  }

  private async getUserContext(
    memberId: string,
    message: Message,
  ): Promise<string> {
    try {
      const userStats = await StatsService.getUserStatsEmbed(
        memberId,
        message.guildId!,
      );
      if (!userStats)
        return "\n\n[User Context: New member, no stats available]";

      const { embed, roles } = userStats;
      const channel = message.channel;

      let channelInfo = "";
      if (channel.isThread()) {
        const thread = channel as ThreadChannel;
        channelInfo = `Thread: "${thread.name}" in #${thread.parent?.name || "unknown"}`;
      } else if ("name" in channel) {
        channelInfo = `Channel: #${channel.name}`;
      }

      return `\n\n[User Context: ${JSON.stringify({ embed, roles: roles?.filter(Boolean) || [], location: channelInfo }, null, 2)}]`;
    } catch {
      return "\n\n[User Context: Unable to retrieve stats]";
    }
  }

  private extractGifFromSteps(steps: any[]): string | null {
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
