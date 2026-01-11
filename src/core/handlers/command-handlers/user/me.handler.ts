import type { APIEmbed, CommandInteraction, TextChannel } from "discord.js";
import { StatsService } from "@/core/services/stats/stats.service";
import {
  checkBotChannelRestriction,
  extractIds,
} from "@/core/utils/command.utils";

export type MeCommandResult = { embed: APIEmbed } | { error: string };

export async function executeMeCommand(
  interaction: CommandInteraction,
): Promise<MeCommandResult> {
  const channelName = (interaction.channel as TextChannel)?.name ?? "";
  const channelError = checkBotChannelRestriction(channelName);
  if (channelError) return { error: channelError };

  const { memberId, guildId } = extractIds(interaction);
  if (!memberId || !guildId)
    return { error: "Could not get user or guild info" };

  const userStats = await StatsService.getUserStatsEmbed(memberId, guildId);
  if (!userStats) return { error: "No stats found" };

  return { embed: userStats.embed };
}
