import { refuseByRank } from "@/core/handlers/command-handlers/mod/jail.handler";
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
    moderatorId: interaction.user.id,
    moderatorName: interaction.user.username,
    reason: reason
      ? `${reason} (triggered by <@${interaction.user.id}>)`
      : `Manual moderation (triggered by <@${interaction.user.id}>)`,
  };

  if (jail) {
    // Same rank rule as /jail, which this would otherwise route around.
    const refusal = await refuseByRank(
      interaction.guild,
      interaction.user.id,
      memberId,
    );
    if (refusal) return { success: false, error: refusal };

    const { status } = await DeleteUserMessagesService.jailUser(params);
    if (status === "no-jail-role") {
      return {
        success: false,
        error:
          "This server has no jail role configured (check STATUS_ROLES), so nobody was jailed and no messages were deleted.",
      };
    }
    DeleteUserMessagesService.deleteUserMessages(params).catch(() => {});
    return { success: true, message: "User jailed. Messages are being deleted in the background." };
  }

  DeleteUserMessagesService.deleteUserMessages(params).catch(() => {});
  return { success: true, message: "Message deletion started in the background." };
}
