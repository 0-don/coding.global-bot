import type { CommandInteraction, TextChannel } from "discord.js";
import { Discord, Slash } from "discordx";
import { LogService } from "@/core/services/logs/log.service";
import { StatsService } from "@/core/services/stats/stats.service";
import {
  checkBotChannelRestriction,
  extractIds,
} from "@/bot/utils/command.utils";

@Discord()
export class Me {
  @Slash({ name: "me", description: "Get your stats", dmPermission: false })
  async me(interaction: CommandInteraction) {
    await interaction.deferReply();
    LogService.logCommandHistory(interaction, "me");

    const channelError = checkBotChannelRestriction(
      (interaction.channel as TextChannel).name,
    );
    if (channelError) return interaction.editReply(channelError);

    const { memberId, guildId } = extractIds(interaction);
    if (!memberId || !guildId)
      return interaction.editReply("Could not get user or guild info");

    const userStats = await StatsService.getUserStatsEmbed(memberId, guildId);
    if (!userStats) return interaction.editReply("No stats found");

    return interaction.editReply({
      embeds: [userStats.embed],
      allowedMentions: { users: [], roles: [] },
    });
  }
}
