import { executeLookbackMe } from "@/core/handlers/command-handlers/user/lookback-me.handler";
import { prisma } from "@/prisma";
import type { CommandInteraction } from "discord.js";
import { ApplicationCommandOptionType } from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";

@Discord()
export class LookbackMe {
  @Slash({
    name: "lookback-me",
    description: "Change lookback date range for yourself",
    dmPermission: false,
  })
  async lookbackMe(
    @SlashOption({
      name: "lookback",
      description: "Set lookback days range",
      required: true,
      minValue: 3,
      maxValue: 9999,
      type: ApplicationCommandOptionType.Integer,
    })
    lookback: number,
    interaction: CommandInteraction,
  ) {
    if (interaction.member?.user.id && interaction.guildId) {
      prisma.memberCommandHistory
        .create({
          data: {
            channelId: interaction.channelId,
            memberId: interaction.member.user.id,
            guildId: interaction.guildId,
            command: "lookback-me",
          },
        })
        .catch(() => {});
    }

    const result = await executeLookbackMe(interaction, lookback);

    if ("error" in result) return interaction.reply(result.error);

    return interaction.reply(result.message);
  }
}
