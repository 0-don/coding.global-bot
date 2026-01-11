import type { CommandInteraction } from "discord.js";
import { LookbackService } from "@/core/services/members/lookback.service";
import { extractIds } from "@/core/utils/command.utils";
import type { MessageResult } from "@/types";

export async function executeLookbackMe(
  interaction: CommandInteraction,
  lookback: number,
): Promise<MessageResult> {
  const { guildId, memberId } = extractIds(interaction);
  if (!guildId || !memberId)
    return { error: "Please use this command in a server" };

  await LookbackService.setMemberLookback(memberId, guildId, lookback);

  const username = interaction.member?.user.username ?? "User";
  return { message: `Lookback set to ${lookback} days for ${username}` };
}
