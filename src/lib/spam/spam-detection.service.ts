import { GoogleGenAI } from "@google/genai";
import dayjs from "dayjs";
import { Message, ThreadChannel } from "discord.js";
import { prisma } from "../../prisma";
import { deleteUserMessages } from "../messages/delete-user-messages";
import { ConfigValidator } from "../config-validator";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

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
   * Main spam detection - only for first messages
   */
  public static async detectSpam(message: Message): Promise<boolean> {
    if (!message.member || message.author.bot || !message.guildId) {
      return false;
    }

    if (!ConfigValidator.isFeatureEnabled("GEMINI_API_KEY")) {
      if (!this._spamDetectionWarningLogged) {
        ConfigValidator.logFeatureDisabled(
          "AI Spam Detection",
          "GEMINI_API_KEY"
        );
        this._spamDetectionWarningLogged = true;
      }
      return false;
    }

    const channel = message.channel;
    if (
      channel.isThread() &&
      channel instanceof ThreadChannel // Type guard
    ) {
      return false; // Skip threads
    }

    // Only check first messages
    const isFirst = await this.isFirstMessage(
      message.author.id,
      message.guildId
    );
    if (!isFirst) return false;

    try {
      const accountAge = dayjs().diff(message.author.createdAt, "days");

      const context = `User info:
- Account age: ${accountAge} days
- Username: ${message.author.username}
- Nickname: ${message.member.nickname || "none"}
- First message in server: yes

Message: "${message.content}"`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite-preview-06-17",
        contents: [context],
        config: {
          systemInstruction: this.SYSTEM_PROMPT,
          temperature: 0.1,
          maxOutputTokens: 10,
        },
      });

      console.log(
        `[${dayjs().format("YYYY-MM-DD HH:mm:ss")}] Spam detection - User: ${message.author.username} (${message.member.nickname || ""}) - Response: ${response.text?.trim()}`
      );

      return response.text?.trim().toLowerCase() === "yes";
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
