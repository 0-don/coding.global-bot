import {
  ApplicationCommandOptionType,
  TextChannel,
  User,
  type CommandInteraction,
} from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import {
  BOT_CHANNELS,
  IS_CONSTRAINED_TO_BOT_CHANNEL,
} from "../../lib/constants.js";
import { LogService } from "../../lib/logs/Log.service.js";
import { StatsService } from "../../lib/stats/Stats.service.js";

@Discord()
export class UserCommand {
  @Slash({
    name: "user",
    description: "Get stats from specific user",
  })
  async user(
    @SlashOption({
      name: "user",
      description: "Select user which stats should be shown",
      required: true,
      type: ApplicationCommandOptionType.User,
    })
    user: User,
    interaction: CommandInteraction
  ) {
    // get text channel
    const channel = (await interaction.channel?.fetch()) as TextChannel;

    // deferReply if it takes longer then usual
    await interaction.deferReply();

    LogService.logCommandHistory(interaction, "user");

    if (IS_CONSTRAINED_TO_BOT_CHANNEL) {
      // if not bot channel, return
      if (!BOT_CHANNELS.includes(channel.name))
        return await interaction.editReply(
          "Please use this command in the bot channel"
        );
    }

    const embed = await StatsService.userStatsEmbed(interaction, user);

    if (typeof embed === "string") return await interaction.editReply(embed);

    // return embed
    return await interaction.editReply({
      embeds: [embed],
      allowedMentions: { users: [] },
    });
  }
}
