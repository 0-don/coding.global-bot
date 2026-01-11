import type { CommandInteraction } from "discord.js";
import { MembersService } from "@/core/services/members/members.service";
import type { MessageResult } from "@/types";

export async function executeLookbackMembers(
  interaction: CommandInteraction,
  lookback: number,
): Promise<MessageResult> {
  if (!interaction.guild) {
    return { error: "This command can only be used in a server" };
  }

  await MembersService.setGuildLookback(
    interaction.guild.id,
    interaction.guild.name,
    lookback,
  );

  return {
    message: `Lookback set to ${lookback} days for ${interaction.guild.name}`,
  };
}
