import type { CommandInteraction, TextChannel } from "discord.js";
import { Discord, Slash } from "discordx";
import {
  BOT_CHANNELS,
  IS_CONSTRAINED_TO_BOT_CHANNEL,
} from "../../lib/constants";
import { LogService } from "../../lib/logs/log.service";
import { StatsService } from "../../lib/stats/stats.service";

@Discord()
export class Me {
  @Slash({
    name: "me",
    description: "Get your stats",
  })
  async me(interaction: CommandInteraction) {
    // get text channel
    // deferReply if it takes longer then usual
    await interaction.deferReply();

    LogService.logCommandHistory(interaction, "me");

    if (IS_CONSTRAINED_TO_BOT_CHANNEL) {
      const channel = (await interaction.channel?.fetch()) as TextChannel;
      // if not bot channel, return
      if (!BOT_CHANNELS.includes(channel.name))
        return await interaction.editReply(
          "Please use this command in the bot channel"
        );
    }
    const embed = await StatsService.userStatsEmbed(interaction);

    if (typeof embed === "string") return await interaction.editReply(embed);

    // return embed with chart img
    return await interaction.editReply({
      embeds: [embed],
      allowedMentions: { users: [] },
    });
  }
}
