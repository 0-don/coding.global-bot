import type { CommandInteraction, TextChannel } from "discord.js";
import { StatsService } from "@/core/services/stats/stats.service";
import {
  checkBotChannelRestriction,
  extractIds,
} from "@/core/utils/command.utils";
import type { EmbedResult } from "@/types";

export async function executeTopCommand(
  interaction: CommandInteraction,
  lookback: number,
): Promise<EmbedResult> {
  const channelName = (interaction.channel as TextChannel)?.name ?? "";
  const channelError = checkBotChannelRestriction(channelName);
  if (channelError) return { error: channelError };

  const { guildId } = extractIds(interaction);
  if (!guildId) return { error: "Could not get guild info" };

  const embed = await StatsService.topStatsEmbed(guildId, lookback);
  return { embed };
}
