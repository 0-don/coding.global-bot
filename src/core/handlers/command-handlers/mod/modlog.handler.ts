import { ModLogService } from "@/core/services/moderation/modlog.service";
import { MuteService } from "@/core/services/moderation/mute.service";
import type { CommandResult } from "@/types";
import type { CommandInteraction, User } from "discord.js";

export async function executeModLog(
  interaction: CommandInteraction,
  user: User | undefined,
): Promise<CommandResult> {
  if (!interaction.guild)
    return { success: false, error: "Guild only command." };

  const moderator = await interaction.guild.members
    .fetch(interaction.user.id)
    .catch(() => null);
  if (!moderator || !MuteService.resolveTier(moderator))
    return {
      success: false,
      error: "You are not allowed to use this command.",
    };

  const rows = await ModLogService.recent(interaction.guild.id, user?.id);
  if (!rows.length) return { success: true, message: "No mod log entries." };

  const lines = rows.map((row) => {
    const when = Math.floor(
      Date.parse(`${row.createdAt.replace(" ", "T")}Z`) / 1000,
    );
    const by = row.moderatorId ? ` by <@${row.moderatorId}>` : "";
    const reason = row.reason ? `: ${row.reason.slice(0, 80)}` : "";
    return `<t:${when}:R> **${row.action}** <@${row.targetId}>${by}${reason}`;
  });

  return { success: true, message: lines.join("\n").slice(0, 2000) };
}
