import type { CommandInteraction } from "discord.js";
import { ApplicationCommandOptionType } from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { executeTopCommand } from "@/core/handlers/command-handlers/user/top.handler";
import { prisma } from "@/prisma";

@Discord()
export class TopCommand {
  @Slash({
    name: "top",
    description: "Get top stats for the guild",
    dmPermission: false,
  })
  async top(
    @SlashOption({
      name: "lookback",
      description: "Lookback days",
      required: false,
      minValue: 1,
      maxValue: 9999,
      type: ApplicationCommandOptionType.Integer,
    })
    lookback: number = 30,
    interaction: CommandInteraction,
  ) {
    await interaction.deferReply();
    if (interaction.member?.user.id && interaction.guildId) {
      prisma.memberCommandHistory.create({
        data: {
          channelId: interaction.channelId,
          memberId: interaction.member.user.id,
          guildId: interaction.guildId,
          command: "top",
        },
      }).catch(() => {});
    }

    const result = await executeTopCommand(interaction, lookback);

    if ("error" in result) return interaction.editReply(result.error);

    return interaction.editReply({
      embeds: [result.embed],
      allowedMentions: { users: [], roles: [] },
    });
  }
}
