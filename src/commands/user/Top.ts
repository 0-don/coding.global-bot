import {
  ApplicationCommandOptionType,
  type CommandInteraction,
  type TextChannel,
} from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import {
  BOT_CHANNELS,
  IS_CONSTRAINED_TO_BOT_CHANNEL,
} from "../../lib/constants.js";
import { LogService } from "../../lib/logs/Log.service.js";
import { StatsService } from "../../lib/stats/Stats.service.js";

@Discord()
export class Top {
  @Slash({
    name: "top",
    description: "Get top user stats",
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
      allowedMentions: { users: [] },
    });
  }
}
