import { DeleteUserMessagesService } from "@/core/services/messages/delete-user-messages.service";
import { ModLogService } from "@/core/services/moderation/modlog.service";
import { RolesService } from "@/core/services/roles/roles.service";
import { safeEditReply } from "@/core/utils/command.utils";
import { JAIL } from "@/shared/config/roles";
import type { CommandResult } from "@/types";
import type { CommandInteraction, GuildMember, User } from "discord.js";

export async function executeDeleteUserMessages(
  interaction: CommandInteraction,
  user: User | undefined,
  userId: string | undefined,
  jail: boolean,
  reason: string | undefined,
  thorough: boolean,
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

  if (DeleteUserMessagesService.isSweeping(guild.id, memberId)) {
    return {
      success: false,
      error: "A deletion for this user is already running.",
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
  };

  // Recorded before the sweep so a restart mid-run cannot lose the entry; the
  // count is filled in once the sweep ends.
  const logged = await ModLogService.record(guild, {
    action: "Messages Deleted",
    targetId: memberId,
    moderatorId: interaction.user.id,
    reason: params.reason,
  });

  if (jail) await DeleteUserMessagesService.jailUser(params);
  await safeEditReply(
    interaction,
    jail ? "User jailed. Deleting messages..." : "Deleting messages...",
  );

  const result = await DeleteUserMessagesService.deleteUserMessages(
    params,
    thorough,
  );
  if (!result) {
    return {
      success: false,
      error: "A deletion for this user is already running.",
    };
  }
  await ModLogService.setAmount(logged, result.deleted);
  return {
    success: true,
    message:
      `Deleted ${result.deleted} message${result.deleted === 1 ? "" : "s"}.` +
      (result.unreadable.length
        ? ` Could not reach ${result.unreadable.join(", ")}.`
        : ""),
  };
}

function outranks(moderator: GuildMember, target: GuildMember): boolean {
  const ownerId = moderator.guild.ownerId;
  if (moderator.id === ownerId) return true;
  if (target.id === ownerId) return false;
  return moderator.roles.highest.position > target.roles.highest.position;
}
