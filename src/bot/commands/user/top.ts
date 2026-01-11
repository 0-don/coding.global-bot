import {
  ApplicationCommandOptionType,
  type CommandInteraction,
  type TextChannel,
} from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { ConfigValidator } from "@/shared/config/validator";
import { BOT_CHANNELS } from "@/shared/config";
import { LogService } from "@/core/services/logs/log.service";
import { StatsService } from "@/core/services/stats/stats.service";

@Discord()
export class Top {
  @Slash({
    name: "top",
    description: "Get top user stats",
    dmPermission: false,
  })
  async top(
    @SlashOption({
      name: "lookback",
      description: "Number of days to look back",
      required: false,
      type: ApplicationCommandOptionType.Integer,
      minValue: 1,
      maxValue: 9999,
    })
    lookback: number = 9999,
    interaction: CommandInteraction,
  ) {
    await interaction.deferReply();

    LogService.logCommandHistory(interaction, "top");
    const channel = interaction.channel as TextChannel;

    if (!interaction.guildId) return await interaction.editReply("No Guild");

    if (ConfigValidator.isFeatureEnabled("IS_CONSTRAINED_TO_BOT_CHANNEL")) {
      if (!ConfigValidator.isFeatureEnabled("BOT_CHANNELS")) {
        ConfigValidator.logFeatureDisabled(
          "Bot Channel Restrictions",
          "BOT_CHANNELS",
        );
        return await interaction.editReply(
          "Bot channel restrictions are enabled but no bot channels are configured.",
        );
      }
      if (!BOT_CHANNELS.includes(channel.name)) {
        return await interaction.editReply(
          "Please use this command in the bot channel",
        );
      }
    }

    const embed = await StatsService.topStatsEmbed(
      interaction.guildId,
      lookback,
    );

    if (typeof embed === "string") return await interaction.editReply(embed);

    // return embed with chart img
    return await interaction.editReply({
      embeds: [embed],
      allowedMentions: { users: [], roles: [] },
    });
  }
}
