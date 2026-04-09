import { DeleteUserMessagesService } from "@/core/services/messages/delete-user-messages.service";
import type { CommandResult } from "@/types";
import type { CommandInteraction, User } from "discord.js";

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

  const params = {
    guild: interaction.guild,
    memberId,
    jail,
    user: user ?? null,
    reason: reason
      ? `${reason} (triggered by <@${interaction.user.id}>)`
      : `Manual moderation (triggered by <@${interaction.user.id}>)`,
  };

  if (jail) {
    await DeleteUserMessagesService.jailUser(params);
    DeleteUserMessagesService.deleteUserMessages(params).catch(() => {});
    return { success: true, message: "User jailed. Messages are being deleted in the background." };
  }

  DeleteUserMessagesService.deleteUserMessages(params).catch(() => {});
  return { success: true, message: "Message deletion started in the background." };
}
