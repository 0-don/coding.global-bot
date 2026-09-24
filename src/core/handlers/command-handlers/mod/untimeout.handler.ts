import { MuteService } from "@/core/services/moderation/mute.service";
import type { CommandResult } from "@/types";
import type { CommandInteraction, GuildMember } from "discord.js";

export async function executeUntimeout(
  interaction: CommandInteraction,
  target: GuildMember,
): Promise<CommandResult> {
  if (!interaction.guild) return { success: false, error: "Guild only command." };

  const moderator = await interaction.guild.members
    .fetch(interaction.user.id)
    .catch(() => null);
  if (!moderator) return { success: false, error: "Could not resolve your member record." };

  const member = await interaction.guild.members.fetch(target.id).catch(() => null);
  if (!member) return { success: false, error: "That member is not in this server." };

  const result = await MuteService.unmute({ target: member, moderator });

  return result.ok
    ? { success: true, message: result.message }
    : { success: false, error: result.error };
}
