import {
  ApplicationCommandOptionType,
  type CommandInteraction,
  type TextChannel,
} from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { LogService } from "@/core/services/logs/log.service";
import { StatsService } from "@/core/services/stats/stats.service";
import {
  checkBotChannelRestriction,
  extractIds,
} from "@/core/utils/command.utils";

@Discord()
export class Top {
  @Slash({ name: "top", description: "Get top user stats", dmPermission: false })
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

    const channelError = checkBotChannelRestriction(
      (interaction.channel as TextChannel).name,
    );
    if (channelError) return interaction.editReply(channelError);

    const { guildId } = extractIds(interaction);
    if (!guildId) return interaction.editReply("Could not get guild info");

    const embed = await StatsService.topStatsEmbed(guildId, lookback);

    return interaction.editReply({
      embeds: [embed],
      allowedMentions: { users: [], roles: [] },
    });
  }
}
