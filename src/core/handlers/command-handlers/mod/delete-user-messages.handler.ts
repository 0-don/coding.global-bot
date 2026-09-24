import { DeleteUserMessagesService } from "@/core/services/messages/delete-user-messages.service";
import { RolesService } from "@/core/services/roles/roles.service";
import { JAIL } from "@/shared/config/roles";
import type { CommandResult } from "@/types";
import type { CommandInteraction, GuildMember, User } from "discord.js";

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

  const guild = interaction.guild;
  const [moderator, target] = await Promise.all([
    guild.members.fetch(interaction.user.id).catch(() => null),
    guild.members.fetch(memberId).catch(() => null),
  ]);
  if (!moderator)
    return { success: false, error: "Could not resolve your member record." };

  if (target && !outranks(moderator, target)) {
    return {
      success: false,
      error: "You cannot use this on someone at or above your rank.",
    };
  }

  const jailRoleId = RolesService.getGuildStatusRoles(guild)[JAIL]?.id;
  if (jail && jailRoleId && target?.roles.cache.has(jailRoleId)) {
    return { success: false, error: "That member is already jailed." };
  }

  const params = {
    guild,
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

function outranks(moderator: GuildMember, target: GuildMember): boolean {
  const ownerId = moderator.guild.ownerId;
  if (moderator.id === ownerId) return true;
  if (target.id === ownerId) return false;
  return moderator.roles.highest.position > target.roles.highest.position;
}
