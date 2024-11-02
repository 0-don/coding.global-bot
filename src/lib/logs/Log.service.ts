import { CommandInteraction } from "discord.js";
import { prisma } from "../../prisma.js";
import { Commands } from "../../types/index.js";

export class LogService {
  public static async logCommandHistory(
    interaction: CommandInteraction,
    command: Commands,
  ): Promise<void> {
    const memberId = interaction.member?.user.id;
    const channelId = interaction.channelId;
    const guildId = interaction.guildId;

    if (!memberId || !guildId) return;

    try {
      await prisma.memberCommandHistory.create({
        data: {
          channelId,
          memberId,
          guildId,
          command,
        },
      });
    } catch (error) {}
  }
}
