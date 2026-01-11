import { AiSpamService } from "@/core/services/ai/ai-spam.service";
import { DeleteUserMessagesService } from "@/core/services/messages/delete-user-messages.service";
import { prisma } from "@/prisma";
import { extractImageUrls } from "@/shared/ai/attachment-processor";
import { ConfigValidator } from "@/shared/config/validator";
import type { SpamDetectionContext } from "@/types";
import { log } from "console";
import dayjs from "dayjs";
import { Message, ThreadChannel } from "discord.js";

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
      const userProfile = await this.getUserProfile(message);
      const messageImages = await extractImageUrls(message);

      const spamContext: SpamDetectionContext = {
        accountAge: dayjs().diff(message.author.createdAt, "days"),
        memberAge: message.member.joinedAt
          ? dayjs().diff(message.member.joinedAt, "days")
          : null,
        channelName:
          ("name" in channel ? channel.name : null) || "Unknown Channel",
        username: message.author.username,
        displayName: message.author.globalName || message.member.displayName,
        hasCustomAvatar:
          message.author.displayAvatarURL() !== message.author.defaultAvatarURL,
        hasBanner: !!userProfile.banner,
        userFlags: userProfile.flags,
        isSystemAccount: userProfile.system,
        roles: message.member.roles.cache
          .map((role) => role.name)
          .filter((name) => name !== "@everyone"),
        messageLength: message.content.length,
        hasLinks: /https?:\/\//.test(message.content),
        hasMentions:
          message.mentions.users.size > 0 || message.mentions.roles.size > 0,
        imageCount: messageImages.length,
        messageContent: message.content,
      };

      const result = await AiSpamService.analyzeForSpam(
        spamContext,
        messageImages,
      );

      if (!result) {
        return false;
      }

      log(
        `[${dayjs().format("YYYY-MM-DD HH:mm:ss")}] Spam detection - User: ${message.author.username} (${message.author.globalName || ""}) - Spam: ${result.isSpam} - Confidence: ${result.confidence} - Reason: ${result.reason}`,
      );

      if (result.isSpam && result.confidence !== "low") {
        await DeleteUserMessagesService.deleteUserMessages({
          jail: true,
          memberId: message.author.id,
          user: message.author,
          guild: message.guild!,
          reason: result.reason,
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error("Spam detection error:", error);
      return false;
    }
  }
}
