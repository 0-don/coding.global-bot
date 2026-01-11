import type { APIEmbed, CommandInteraction, TextChannel } from "discord.js";
import { StatsService } from "@/core/services/stats/stats.service";
import {
  checkBotChannelRestriction,
  extractIds,
} from "@/core/utils/command.utils";

export type TopCommandResult = { embed: APIEmbed } | { error: string };

export async function executeTopCommand(
  interaction: CommandInteraction,
  lookback: number,
): Promise<TopCommandResult> {
  const channelName = (interaction.channel as TextChannel)?.name ?? "";
  const channelError = checkBotChannelRestriction(channelName);
  if (channelError) return { error: channelError };

  const { guildId } = extractIds(interaction);
  if (!guildId) return { error: "Could not get guild info" };

  const embed = await StatsService.topStatsEmbed(guildId, lookback);
  return { embed };
}
