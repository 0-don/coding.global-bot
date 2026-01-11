import type { CommandInteraction, User } from "discord.js";
import { deleteUserMessages } from "@/core/services/messages/delete-user-messages";
import type { CommandResult } from "@/types";

export async function executeDeleteUserMessages(
  interaction: CommandInteraction,
  user: User | undefined,
  userId: string | undefined,
  jail: boolean,
  reason: string | undefined,
): Promise<CommandResult> {
  const memberId = user?.id ?? userId;
  if (!memberId || !interaction.guild) {
    return { success: false, error: "Invalid user or guild" };
  }

  await deleteUserMessages({
    guild: interaction.guild,
    memberId,
    jail,
    user: user ?? null,
    reason: reason ?? "Manual moderation",
  });

  return { success: true };
}
