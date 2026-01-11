import {
  ApplicationCommandOptionType,
  TextChannel,
  User,
  type CommandInteraction,
} from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { LogService } from "@/core/services/logs/log.service";
import { StatsService } from "@/core/services/stats/stats.service";
import {
  checkBotChannelRestriction,
  extractIds,
} from "@/core/utils/command.utils";

@Discord()
export class UserCommand {
  @Slash({
    name: "user",
    description: "Get stats from specific user",
    dmPermission: false,
  })
  async user(
    @SlashOption({
      name: "user",
      description: "Select user which stats should be shown",
      required: true,
      type: ApplicationCommandOptionType.User,
    })
    user: User,
    interaction: CommandInteraction,
  ) {
    await interaction.deferReply();
    LogService.logCommandHistory(interaction, "user");

    const channelError = checkBotChannelRestriction(
      (interaction.channel as TextChannel).name,
    );
    if (channelError) return interaction.editReply(channelError);

    const { guildId } = extractIds(interaction);
    if (!guildId) return interaction.editReply("Could not get guild info");

    const userStats = await StatsService.getUserStatsEmbed(user.id, guildId);
    if (!userStats) return interaction.editReply("No stats found");

    return interaction.editReply({
      embeds: [userStats.embed],
      allowedMentions: { users: [], roles: [] },
    });
  }
}
