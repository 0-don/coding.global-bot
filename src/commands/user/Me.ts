import type { CommandInteraction, TextChannel } from "discord.js";
import { PermissionFlagsBits } from "discord.js";
import { Discord, Slash } from "discordx";
import { BOT_CHANNEL } from "../../lib/constants.js";
import { StatsService } from "../../lib/stats/Stats.service.js";

@Discord()
export class Me {
  @Slash({
    name: "me",
    description: "Get your stats",
    defaultMemberPermissions: PermissionFlagsBits.DeafenMembers,
  })
  async me(interaction: CommandInteraction) {
    // get text channel
    // deferReply if it takes longer then usual
    await interaction.deferReply();

    const channel = (await interaction.channel?.fetch()) as TextChannel;

    // if not bot channel, return
    if (channel.name !== BOT_CHANNEL) return await interaction.editReply("Please use this command in the bot channel");

    const embed = await StatsService.userStatsEmbed(interaction);

    if (typeof embed === "string") return await interaction.editReply(embed);

    // return embed with chart img
    return await interaction.editReply({
      embeds: [embed],
      allowedMentions: { users: [] },
    });
  }
}
