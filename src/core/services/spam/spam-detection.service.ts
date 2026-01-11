import { DeleteUserMessagesService } from "@/core/services/messages/delete-user-messages.service";
import { prisma } from "@/prisma";
import { extractImageUrls } from "@/shared/ai/attachment-processor";
import { SPAM_SYSTEM_PROMPT } from "@/shared/ai/system-prompt";
import { ConfigValidator } from "@/shared/config/validator";
import { googleClient } from "@/shared/integrations/google-ai";
import { generateText, Output } from "ai";
import { log } from "console";
import dayjs from "dayjs";
import { Message, ThreadChannel } from "discord.js";
import { z } from "zod";

export class SpamDetectionService {
  private static _spamDetectionWarningLogged = false;

  private static async isFirstMessage(
    memberId: string,
    guildId: string,
  ): Promise<boolean> {
    const messageCount = await prisma.memberMessages.count({
      where: { memberId, guildId },
    });
    return messageCount === 0;
  }

  private static async getUserProfile(message: Message) {
    try {
      const userProfile = await message.author.fetch();

      return {
        banner: userProfile.bannerURL() || null,
        accentColor: userProfile.accentColor || null,
        hexAccentColor: userProfile.hexAccentColor || null,
        flags: userProfile.flags?.toArray() || [],
        system: userProfile.system,
        collectibles: userProfile.collectibles || null,
      };
    } catch (error) {
      console.error("Error fetching user profile:", error);
      return {
        banner: null,
        accentColor: null,
        hexAccentColor: null,
        flags: [],
        system: false,
        collectibles: null,
      };
    }
  }

  public static async detectSpamFirstMessageWithAi(
    message: Message,
  ): Promise<boolean> {
    if (!message.member || message.author.bot || !message.guildId) {
      return false;
    }

    if (!ConfigValidator.isFeatureEnabled("GOOGLE_GENERATIVE_AI_API_KEY")) {
      if (!this._spamDetectionWarningLogged) {
        ConfigValidator.logFeatureDisabled(
          "AI Spam Detection",
          "GOOGLE_GENERATIVE_AI_API_KEY",
        );
        this._spamDetectionWarningLogged = true;
      }
      return false;
    }

    const channel = message.channel;
    if (channel.isThread() && channel instanceof ThreadChannel) {
      return false;
    }

    const isFirst = await this.isFirstMessage(
      message.author.id,
      message.guildId,
    );
    if (!isFirst) return false;

    const hasText = message.content.trim().length > 0;
    const hasImages = message.attachments.some((att) =>
      att.contentType?.startsWith("image/"),
    );

    if (!hasText && !hasImages) {
      return false;
    }

    try {
      const accountAge = dayjs().diff(message.author.createdAt, "days");
      const channelName = "name" in channel ? channel.name : "Unknown Channel";

      const userProfile = await this.getUserProfile(message);

      const hasCustomAvatar =
        message.author.displayAvatarURL() !== message.author.defaultAvatarURL;
      const hasLinks = /https?:\/\//.test(message.content);
      const hasMentions =
        message.mentions.users.size > 0 || message.mentions.roles.size > 0;

      const joinedAt = message.member.joinedAt;
      const memberAge = joinedAt ? dayjs().diff(joinedAt, "days") : null;
      const roles = message.member.roles.cache
        .map((role) => role.name)
        .filter((name) => name !== "@everyone");

      const messageImages = await extractImageUrls(message);
      const imageCount = messageImages.length;

      const contextText = `User info:
- Account age: ${accountAge} days
- Server member for: ${memberAge !== null ? `${memberAge} days` : "unknown"}
- Channel: ${channelName}
- Username: ${message.author.username}
- Display name: ${message.author.globalName || message.member.displayName}
- Avatar: ${hasCustomAvatar ? "custom" : "default"}
- Banner: ${userProfile.banner ? "has banner" : "no banner"}
- User flags: ${userProfile.flags.length > 0 ? userProfile.flags.join(", ") : "none"}
- System account: ${userProfile.system}
- Roles: ${roles.length > 0 ? roles.join(", ") : "none"}
- Message length: ${message.content.length} characters
- Has links: ${hasLinks}
- Has mentions: ${hasMentions}
- Has images: ${imageCount > 0 ? `yes (${imageCount})` : "no"}

Message: "${message.content}"${imageCount > 0 ? "\n\nPlease analyze the attached image(s) for spam indicators like portfolio screenshots, service advertisements, promotional graphics, or other spam-related visual content." : ""}`;

      const result = await googleClient.executeWithRotation(async () => {
        return await generateText({
          model: googleClient.getModel(),
          system: SPAM_SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: contextText },
                ...messageImages.map((url) => ({
                  type: "image" as const,
                  image: url,
                })),
              ],
            },
          ],
          output: Output.object({
            schema: z.object({
              isSpam: z.boolean(),
              confidence: z.enum(["high", "medium", "low"]),
              reason: z.string(),
            }),
          }),
          temperature: 0.1,
        });
      });

      if (!result) {
        return false;
      }

      const object = result.output;

      log(
        `[${dayjs().format("YYYY-MM-DD HH:mm:ss")}] Spam detection - User: ${message.author.username} (${message.author.globalName || ""}) - Spam: ${object.isSpam} - Confidence: ${object.confidence} - Reason: ${object.reason}`,
      );

      if (object.isSpam && object.confidence !== "low") {
        await this.handleSpam(message, object.reason);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Spam detection error:", error);
      return false;
    }
  }

  public static async handleSpam(
    message: Message,
    reason?: string,
  ): Promise<void> {
    try {
      await DeleteUserMessagesService.deleteUserMessages({
        jail: true,
        memberId: message.author.id,
        user: message.author,
        guild: message.guild!,
        reason: reason ?? "AI detected spam in first message",
      });
    } catch (error) {
      console.error("Error handling spam:", error);
    }
  }
}
