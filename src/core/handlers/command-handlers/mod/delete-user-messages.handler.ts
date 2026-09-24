import { DeleteUserMessagesService } from "@/core/services/messages/delete-user-messages.service";
import { RolesService } from "@/core/services/roles/roles.service";
import { db } from "@/lib/db";
import { memberRole } from "@/lib/db-schema";
import { JAIL } from "@/shared/config/roles";
import { and, eq } from "drizzle-orm";
import type { CommandResult } from "@/types";
import type { CommandInteraction, Guild, User } from "discord.js";

/**
 * Whether the bot can carry out this jail.
 *
 * Moderators may jail anyone regardless of rank, but the bot cannot strip roles
 * that sit above its own. Jailing anyway half-jails the member - they gain the
 * jail role while keeping every role the bot could not strip - which is worse
 * than refusing outright.
 *
 * Returns the refusal to show, or null when the jail may proceed.
 */
async function refuseJail(
  guild: Guild,
  invokerId: string,
  targetId: string,
): Promise<string | null> {
  if (invokerId === targetId) return "You cannot jail yourself.";

  const target = await guild.members.fetch(targetId).catch(() => null);

  // Not in the server: there are no roles to strip, and the jail is only a
  // database record until they return.
  if (!target) return null;

  if (!target.manageable) {
    return "I cannot jail that member - their highest role sits above mine, so I cannot remove their roles.";
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

  // Refused rather than repeated: a second jail cannot punish them further.
  // Deleting more of a jailed member's messages still works without jail.
  if (jail) {
    const refusal = await refuseJail(
      interaction.guild,
      interaction.user.id,
      memberId,
    );
    if (refusal) return { success: false, error: refusal };

    const jailRoleId = RolesService.getGuildStatusRoles(interaction.guild)[
      JAIL
    ]?.id;
    const target = await interaction.guild.members
      .fetch(memberId)
      .catch(() => null);

    // A member who left while jailed has no roles to read, only the stored
    // jail row that is re-applied when they return.
    const alreadyJailed =
      !!jailRoleId &&
      (target
        ? target.roles.cache.has(jailRoleId)
        : !!(await db.query.memberRole.findFirst({
            where: and(
              eq(memberRole.memberId, memberId),
              eq(memberRole.guildId, interaction.guild.id),
              eq(memberRole.roleId, jailRoleId),
            ),
          })));

    if (alreadyJailed) {
      return {
        success: false,
        error:
          "That member is already jailed. Run it without jail to delete more of their messages.",
      };
    }
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
    const { status } = await DeleteUserMessagesService.jailUser(params);
    DeleteUserMessagesService.deleteUserMessages(params).catch(() => {});
    return {
      success: true,
      message:
        status === "no-jail-role"
          ? "This server has no jail role configured (check STATUS_ROLES), so they were not jailed. Messages are being deleted in the background."
          : "User jailed. Messages are being deleted in the background.",
    };
  }

  DeleteUserMessagesService.deleteUserMessages(params).catch(() => {});
  return { success: true, message: "Message deletion started in the background." };
}
