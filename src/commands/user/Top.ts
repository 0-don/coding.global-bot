import type { CommandInteraction, TextChannel } from "discord.js";
import { Discord, Slash } from "discordx";
import { BOT_CHANNEL } from "../../lib/constants.js";
import { StatsService } from "../../lib/stats/Stats.service.js";

@Discord()
export class Top {
  @Slash({
    name: "top",
    description: "Get top user stats",
  })
  async top(interaction: CommandInteraction) {
    // get text channel
    const channel = (await interaction.channel?.fetch()) as TextChannel;

    // deferReply if it takes longer then usual
    await interaction.deferReply();

    if (!interaction.guildId) return await interaction.editReply("No Guild");

    if (channel.name !== BOT_CHANNEL)
      // if not bot channel, return
      return await interaction.editReply("Please use this command in the bot channel");

    const embed = await StatsService.topStatsEmbed(interaction.guildId);

    if (typeof embed === "string") return await interaction.editReply(embed);

    // return embed with chart img
    return await interaction.editReply({
      embeds: [embed],
      allowedMentions: { users: [] },
    });
  }
}
