import dayjs from "dayjs";
import type { CommandInteraction } from "discord.js";
import { Discord, Slash } from "discordx";
import { prisma } from "../../prisma.js";

@Discord()
export class AiReset {
  @Slash({
    name: "ai-reset",
    description: "Reset AI context message History",
  })
  async aiReset(interaction: CommandInteraction) {
    await interaction.deferReply();

    const user = interaction.user;

    await prisma.memberGuild.update({
      where: {
        member_guild: {
          guildId: interaction.guildId!,
          memberId: user.id,
        },
      },
      data: { gptId: null, gptDate: dayjs().subtract(60, "minute").toDate() },
    });

    return interaction.editReply("AI context reset");
  }
}
