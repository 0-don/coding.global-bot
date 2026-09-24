import { DeleteUserMessagesService } from "@/core/services/messages/delete-user-messages.service";
import type { CommandResult } from "@/types";
import type { CommandInteraction, Guild, User } from "discord.js";

/**
 * Whether this moderator may act on this member.
 *
 * Manage Roles is a single permission, so without this any moderator could
 * wipe or jail any other - or an administrator. Discord gates its own role
 * actions on the acting member's highest role sitting above the target's, and
 * this reads the same way rather than inventing a second rule.
 *
 * Returns the refusal to show, or null when the action may proceed.
 */
async function refuseByRank(
  guild: Guild,
  invokerId: string,
  targetId: string,
  jail: boolean,
): Promise<string | null> {
  if (jail && invokerId === targetId) return "You cannot jail yourself.";

  const target = await guild.members.fetch(targetId).catch(() => null);

  // Not in the server: there are no roles to weigh, and a jail is only a
  // database record until they return.
  if (!target) return null;

  // The bot's own position is a separate limit from the moderator's. Ignoring
  // it half-jails the member - they gain the jail role while keeping every
  // role the bot could not strip - which is worse than refusing outright.
  if (jail && !target.manageable) {
    return "I cannot jail that member - their highest role sits above mine, so I cannot remove their roles.";
  }

  // The owner outranks everyone, and your own messages are yours to delete.
  if (invokerId === guild.ownerId || invokerId === targetId) return null;

  const invoker = await guild.members.fetch(invokerId).catch(() => null);
  if (!invoker)
    return "I could not check your roles, so I have not done anything.";

  if (target.roles.highest.position >= invoker.roles.highest.position) {
    return "You cannot use this on someone whose highest role is equal to or above your own.";
  }

  return null;
}

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

  const refusal = await refuseByRank(
    interaction.guild,
    interaction.user.id,
    memberId,
    jail,
  );
  if (refusal) return { success: false, error: refusal };

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
    const { status } = await DeleteUserMessagesService.jailUser(params);
    DeleteUserMessagesService.deleteUserMessages(params).catch(() => {});
    return {
      success: true,
      message:
        status === "no-jail-role"
          ? "This server has no jail role configured (check STATUS_ROLES), so they were not jailed. Messages are being deleted in the background."
          : status === "already-jailed"
            ? "They were already jailed. Messages are being deleted in the background."
            : "User jailed. Messages are being deleted in the background.",
    };
  }

  DeleteUserMessagesService.deleteUserMessages(params).catch(() => {});
  return { success: true, message: "Message deletion started in the background." };
}
