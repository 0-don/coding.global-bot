import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import dayjs from "dayjs";
import { Message, ThreadChannel } from "discord.js";
import { prisma } from "../../prisma";
import { ConfigValidator } from "../config-validator";
import { deleteUserMessages } from "../messages/delete-user-messages";

export class SpamDetectionService {
  private static _spamDetectionWarningLogged = false;

  private static readonly SYSTEM_PROMPT = `You are a spam detection AI for a coding/programming Discord server.

This server is for programming discussions, learning, and community help - NOT for business promotion or job seeking.

SPAM INDICATORS (respond "yes"):
- Listing professional services or skills for hire
- "Available for work" or "open to work" messages  
- Portfolio/website promotion in introduction
- Offering paid services (automation, AI development, etc.)
- "Contact me for projects" or similar business solicitation
- First messages that read like service advertisements
- Professional service descriptions with contact information

LEGITIMATE CONTENT (respond "no"):
- Asking programming questions
- Sharing learning resources
- Casual introductions without business promotion
- Technical discussions
- Offering free help or collaboration

The message you're analyzing contains multiple service offerings, portfolio promotion, and work solicitation - classic spam patterns.

Respond with only "yes" if spam, "no" if legitimate.`;

  /**
   * Check if this is user's first message in the server
   */
  private static async isFirstMessage(
    memberId: string,
    guildId: string
  ): Promise<boolean> {
    const messageCount = await prisma.memberMessages.count({
      where: { memberId, guildId },
    });
    return messageCount === 0;
  }

  /**
   * Get available user profile information
   */
  private static async getUserProfile(message: Message) {
    try {
      // Fetch full user profile to get additional properties
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

  /**
   * Main spam detection - only for first messages
   */
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

    // Only check first messages
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

      // Get available profile info
      const userProfile = await this.getUserProfile(message);

      // Extract metadata checks
      const hasCustomAvatar =
        message.author.displayAvatarURL() !== message.author.defaultAvatarURL;
      const hasLinks = /https?:\/\//.test(message.content);
      const hasMentions =
        message.mentions.users.size > 0 || message.mentions.roles.size > 0;

      // Check member-specific info
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

      const { text } = await generateText({
        model: google("gemini-2.5-flash"),
        system: this.SYSTEM_PROMPT,
        prompt: context,
        temperature: 0.1,
        maxOutputTokens: 10,
      });

      console.log(
        `[${dayjs().format("YYYY-MM-DD HH:mm:ss")}] Spam detection - User: ${message.author.username} (${message.author.globalName || ""}) - Response: ${text.trim()}`
      );

      return text.trim().toLowerCase() === "yes";
    } catch (error) {
      console.error("Spam detection error:", error);
      return false;
    }
  }

  /**
   * Handle detected spam
   */
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
