import { GoogleGenAI } from "@google/genai";
import dayjs from "dayjs";
import { Message } from "discord.js";
import { prisma } from "../../prisma.js";
import { deleteUserMessages } from "../messages/deleteUserMessages.js";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export class SpamDetectionService {
  private static readonly SYSTEM_PROMPT = `You are a spam detection AI for a coding/programming Discord server. 

This is a coding community for legitimate programming discussions, job opportunities, and tech collaboration. 

Common spam patterns we see:
- Fake job interview services
- Unauthorized freelance advertisements  
- Scam "remote work" offers promising high pay for minimal work
- Suspicious AI/ML service promotions
- Identity theft schemes ("interview partners", "laptop keepers")
- Hacking/illegal services

Respond with only "yes" if the message is spam, "no" if legitimate.`;

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

    // Only check first messages
    const isFirst = await this.isFirstMessage(
      message.author.id,
      message.guildId
    );
    if (!isFirst) return false;

    try {
      // Use Discord.js built-in createdAt property
      const accountAge = dayjs().diff(message.author.createdAt, "days");

      const context = `User info:
- Account age: ${accountAge} days
- Username: ${message.author.username}
- Nickname: ${message.member.nickname || "none"}
- First message in server: yes

Message: "${message.content}"`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [context],
        config: {
          systemInstruction: this.SYSTEM_PROMPT,
          temperature: 0.1,
          maxOutputTokens: 10,
        },
      });

      console.log(`Spam detection response: ${response.text?.trim()}`);

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

      console.log(`Spam detected and handled: ${message.author.username}`);
    } catch (error) {
      console.error("Error handling spam:", error);
    }
  }
}
