import { google } from "@ai-sdk/google";
import { generateText, ModelMessage, StepResult } from "ai";
import console, { error } from "console";
import { Message, OmitPartialGroupDMChannel } from "discord.js";
import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";
import { ConfigValidator } from "../../lib/config-validator";
import { AI_SYSTEM_PROMPT } from "./prompt";
import {
  channelMessages,
  CODING_GLOBAL_PATTERN,
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

    const userMsg = message.content
      .replace(mention, "")
      .replace(CODING_GLOBAL_PATTERN, "")
      .trim();

    const { replyContext, repliedImages } = await this.getReplyContext(message);

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
    const fullMessage = userMsg + replyContext;

    try {
      const messageImages = await makeImageParts(message);
      const allImages = [...messageImages, ...repliedImages];

      // Create user message
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

      const { text, steps } = await generateText({
        model: google("gemini-2.5-flash"),
        system: AI_SYSTEM_PROMPT,
        messages: [...messages],
        tools: TOOLS,
      });

      const gifUrl = this.extractGifFromSteps(steps);

      // Improved response handling
      let reply = text?.trim();

      // Add assistant message to history
      messages.push({
        role: "assistant",
        content: reply,
      });

      // Trim history if too long
      if (messages.length > MAX_MESSAGES_PER_CHANNEL) {
        messages.splice(0, messages.length - MAX_MESSAGES_PER_CHANNEL);
      }

      // Update channel history
      channelMessages.set(message.channel.id, messages);

      await message.reply({
        content: reply,
        files: gifUrl
          ? [{ attachment: gifUrl, name: "reaction.gif" }]
          : undefined,
      });
    } catch (err) {
      error("AI error:", err);
      await message.reply(
        "Something went wrong while thinking. Try again later!"
      );
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
      if (!repliedMessage || repliedMessage.author.bot)
        return { replyContext: "", repliedImages: [] };

      const repliedUser = repliedMessage.author;
      const messageContext = await gatherMessageContext(repliedMessage);
      const contextType = messageContext.context.includes("\n")
        ? "conversation"
        : "message";

      return {
        replyContext: `\n\nUser is asking about this ${contextType} from ${repliedUser.username} (${repliedUser.globalName || repliedUser.username}):\n"${messageContext.context}"`,
        repliedImages: messageContext.images,
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
