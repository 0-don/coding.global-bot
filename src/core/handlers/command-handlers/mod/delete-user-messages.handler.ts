import { DeleteUserMessagesService } from "@/core/services/messages/delete-user-messages.service";
import { ModLogService } from "@/core/services/moderation/modlog.service";
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
  if (!/^\d{17,20}$/.test(memberId)) {
    return { success: false, error: "user-id must be a Discord user ID." };
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

  if (jail) {
    const jailRole = RolesService.getGuildStatusRoles(guild)[JAIL];
    if (!jailRole?.editable) {
      return {
        success: false,
        error: "Jail failed, the jail role is missing or above the bot's role.",
      };
    }
    if (target?.roles.cache.has(jailRole.id)) {
      return { success: false, error: "That member is already jailed." };
    }
  }

  const params = {
    guild,
    memberId,
    jail,
    user: user ?? null,
    reason: reason || "Manual moderation",
    moderatorId: interaction.user.id,
    startChannelId: interaction.channelId,
  };

  // Recorded before the sweep so a restart mid-run cannot lose the entry; the
  // count is filled in once the sweep ends.
  const logged = await ModLogService.record(guild, {
    action: "Messages Deleted",
    targetId: memberId,
    moderatorId: interaction.user.id,
    reason: params.reason,
  });
  const sweep = () =>
    DeleteUserMessagesService.deleteUserMessages(params)
      .then((amount) => {
        if (amount !== null) return ModLogService.setAmount(logged, amount);
      })
      .catch(() => {});

  if (jail) {
    await DeleteUserMessagesService.jailUser(params);
    sweep();
    return { success: true, message: "User jailed. Messages are being deleted in the background." };
  }

  sweep();
  return { success: true, message: "Message deletion started in the background." };
}

function outranks(moderator: GuildMember, target: GuildMember): boolean {
  const ownerId = moderator.guild.ownerId;
  if (moderator.id === ownerId) return true;
  if (target.id === ownerId) return false;
  return moderator.roles.highest.position > target.roles.highest.position;
}
