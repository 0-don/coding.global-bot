import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import dayjs from "dayjs";
import { Message, ThreadChannel } from "discord.js";
import { z } from "zod";
import { prisma } from "../../prisma";
import { ConfigValidator } from "../config-validator";
import { deleteUserMessages } from "../messages/delete-user-messages";

export class SpamDetectionService {
  private static _spamDetectionWarningLogged = false;

  private static readonly SYSTEM_PROMPT = `You are a spam detector for a programming Discord server.

Analyze if the message is spam based on these criteria:

SPAM INDICATORS:
- Job seeking: "available for work", "open to opportunities", "looking for projects"
- Service promotion: offering paid services, listing skills for hire
- Portfolio spam: promoting personal website/portfolio in first message
- Business solicitation: "contact me for", "DM for services"
- Generic intro + services: "I'm a developer who does X, Y, Z [contact info]"

LEGITIMATE CONTENT:
- Asking programming questions
- Casual introduction without business promotion
- Sharing code/resources
- Technical discussion
- Offering help (not services)

Provide your confidence level:
- high: clearly spam or clearly legitimate
- medium: some indicators present but ambiguous
- low: uncertain, edge case`;

  private static async isFirstMessage(
    memberId: string,
    guildId: string
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

  public static async detectSpam(message: Message): Promise<boolean> {
    if (!message.member || message.author.bot || !message.guildId) {
      return false;
    }

    if (!ConfigValidator.isFeatureEnabled("GOOGLE_GENERATIVE_AI_API_KEY")) {
      if (!this._spamDetectionWarningLogged) {
        ConfigValidator.logFeatureDisabled(
          "AI Spam Detection",
          "GOOGLE_GENERATIVE_AI_API_KEY"
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
      message.guildId
    );
    if (!isFirst) return false;

    if (!message.content.trim()) {
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

      const context = `User info:
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

Message: "${message.content}"`;

      const { object } = await generateObject({
        model: google("gemini-2.5-flash"),
        system: this.SYSTEM_PROMPT,
        prompt: context,
        schema: z.object({
          isSpam: z.boolean(),
          confidence: z.enum(["high", "medium", "low"]),
        }),
        temperature: 0.1,
      });

      console.log(
        `[${dayjs().format("YYYY-MM-DD HH:mm:ss")}] Spam detection - User: ${message.author.username} (${message.author.globalName || ""}) - Spam: ${object.isSpam} - Confidence: ${object.confidence}`
      );

      return object.isSpam && object.confidence !== "low";
    } catch (error) {
      console.error("Spam detection error:", error);
      return false;
    }
  }

  public static async handleSpam(message: Message): Promise<void> {
    try {
      await deleteUserMessages({
        days: 1,
        jail: true,
        memberId: message.author.id,
        user: message.author,
        guild: message.guild!,
      });
    } catch (error) {
      console.error("Error handling spam:", error);
    }
  }
}
