import {
  ApplicationCommandOptionType,
  type CommandInteraction,
  type TextChannel,
} from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { ConfigValidator } from "../../lib/config-validator";
import {
  BOT_CHANNELS,
  IS_CONSTRAINED_TO_BOT_CHANNEL,
} from "../../lib/constants";
import { LogService } from "../../lib/logs/log.service";
import { StatsService } from "../../lib/stats/stats.service";

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
    interaction: CommandInteraction
  ) {
    // get text channel
    LogService.logCommandHistory(interaction, "top");
    const channel = (await interaction.channel?.fetch()) as TextChannel;

    // deferReply if it takes longer then usual
    await interaction.deferReply();

    if (!interaction.guildId) return await interaction.editReply("No Guild");

    if (!ConfigValidator.isFeatureEnabled("IS_CONSTRAINED_TO_BOT_CHANNEL")) {
      // Bot channel restrictions disabled, allow command anywhere
    } else if (!ConfigValidator.isFeatureEnabled("BOT_CHANNELS")) {
      ConfigValidator.logFeatureDisabled(
        "Bot Channel Restrictions",
        "BOT_CHANNELS"
      );
      return await interaction.editReply(
        "Bot channel restrictions are enabled but no bot channels are configured."
      );
    } else {
      const channel = (await interaction.channel?.fetch()) as TextChannel;
      if (!BOT_CHANNELS.includes(channel.name)) {
        return await interaction.editReply(
          "Please use this command in the bot channel"
        );
      }
    }

    if (IS_CONSTRAINED_TO_BOT_CHANNEL) {
      if (!BOT_CHANNELS.includes(channel.name))
        // if not bot channel, return
        return await interaction.editReply(
          "Please use this command in the bot channel"
        );
    }
    const embed = await StatsService.topStatsEmbed(
      interaction.guildId,
      lookback
    );

    if (typeof embed === "string") return await interaction.editReply(embed);

    // return embed with chart img
    return await interaction.editReply({
      embeds: [embed],
      allowedMentions: { users: [], roles: [] },
    });
  }
}
