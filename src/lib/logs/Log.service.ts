import { CommandInteraction } from "discord.js";
import { prisma } from "../../prisma.js";
import { Commands } from "../../types/index.js";

export class LogService {
  public static async logCommandHistory(
    interaction: CommandInteraction,
    command: Commands
  ): Promise<void> {
    const memberId = interaction.member?.user.id;
    const guildId = interaction.guildId;

    if (!memberId || !guildId) return;

    await prisma.memberCommandHistory.create({
      data: {
        memberId: memberId,
        guildId: guildId,
        command: command,
      },
    });
  }
}
