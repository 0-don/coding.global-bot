import type { APIEmbed, CommandInteraction, TextChannel } from "discord.js";
import { StatsService } from "@/core/services/stats/stats.service";
import {
  checkBotChannelRestriction,
  extractIds,
} from "@/core/utils/command.utils";

export type UserCommandResult = { embed: APIEmbed } | { error: string };

export async function executeUserCommand(
  interaction: CommandInteraction,
  userId: string,
): Promise<UserCommandResult> {
  const channelName = (interaction.channel as TextChannel)?.name ?? "";
  const channelError = checkBotChannelRestriction(channelName);
  if (channelError) return { error: channelError };

  const { guildId } = extractIds(interaction);
  if (!guildId) return { error: "Could not get guild info" };

  const userStats = await StatsService.getUserStatsEmbed(userId, guildId);
  if (!userStats) return { error: "No stats found" };

  return { embed: userStats.embed };
}
