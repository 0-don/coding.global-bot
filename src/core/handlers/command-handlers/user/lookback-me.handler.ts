import type { CommandInteraction } from "discord.js";
import { MembersService } from "@/core/services/members/members.service";
import { extractIds } from "@/core/utils/command.utils";
import type { MessageResult } from "@/types";

export async function executeLookbackMe(
  interaction: CommandInteraction,
  lookback: number,
): Promise<MessageResult> {
  const { guildId, memberId } = extractIds(interaction);
  if (!guildId || !memberId)
    return { error: "Please use this command in a server" };

  await MembersService.setMemberLookback(memberId, guildId, lookback);

  const username = interaction.member?.user.username ?? "User";
  return { message: `Lookback set to ${lookback} days for ${username}` };
}
