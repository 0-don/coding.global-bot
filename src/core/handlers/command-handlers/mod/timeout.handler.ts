import { MuteService } from "@/core/services/moderation/mute.service";
import { parseDurationMinutes } from "@/shared/config/moderation";
import type { CommandResult } from "@/types";
import type { CommandInteraction, GuildMember } from "discord.js";

export async function executeTimeout(
  interaction: CommandInteraction,
  target: GuildMember,
  duration: string,
  reason: string | undefined,
): Promise<CommandResult> {
  if (!interaction.guild) return { success: false, error: "Guild only command." };

  const moderator = await interaction.guild.members
    .fetch(interaction.user.id)
    .catch(() => null);
  if (!moderator) return { success: false, error: "Could not resolve your member record." };

  const minutes = parseDurationMinutes(duration);
  if (!minutes)
    return {
      success: false,
      error: "Invalid duration. Use a value like 10m, 2h or 1d, up to 28d.",
    };

  const member = await interaction.guild.members.fetch(target.id).catch(() => null);
  if (!member) return { success: false, error: "That member is not in this server." };

  const result = await MuteService.mute({ target: member, moderator, minutes, reason });

  return result.ok
    ? { success: true, message: result.message }
    : { success: false, error: result.error };
}
