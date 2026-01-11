import type { CommandInteraction } from "discord.js";
import { LookbackService } from "@/core/services/members/lookback.service";
import { extractIds } from "@/core/utils/command.utils";

export type LookbackMeResult = { message: string } | { error: string };

export async function executeLookbackMe(
  interaction: CommandInteraction,
  lookback: number,
): Promise<LookbackMeResult> {
  const { guildId, memberId } = extractIds(interaction);
  if (!guildId || !memberId)
    return { error: "Please use this command in a server" };

  await LookbackService.setMemberLookback(memberId, guildId, lookback);

  const username = interaction.member?.user.username ?? "User";
  return { message: `Lookback set to ${lookback} days for ${username}` };
}
