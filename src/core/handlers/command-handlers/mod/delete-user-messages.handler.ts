import { DeleteUserMessagesService } from "@/core/services/messages/delete-user-messages.service";
import { RolesService } from "@/core/services/roles/roles.service";
import { db } from "@/lib/db";
import { memberRole } from "@/lib/db-schema";
import { JAIL } from "@/shared/config/roles";
import { and, eq } from "drizzle-orm";
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
  purge: boolean = true,
  days: number | undefined = undefined,
): Promise<CommandResult> {
  const memberId = user?.id ?? userId;
  if (!memberId || !interaction.guild) {
    return { success: false, error: "Invalid user or guild" };
  }

  if (!jail && !purge) {
    return {
      success: false,
      error: "Nothing to do: turn on jail, purge, or both.",
    };
  }

  const refusal = await refuseByRank(
    interaction.guild,
    interaction.user.id,
    memberId,
    jail,
  );
  if (refusal) return { success: false, error: refusal };

  // Refused rather than repeated: a second jail cannot punish them further.
  // Deleting more of a jailed member's messages is still a jail:false away.
  if (jail) {
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
          "That member is already jailed. Run this with jail:false to delete more of their messages.",
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
    days,
    reason: reason
      ? `${reason} (triggered by <@${interaction.user.id}>)`
      : `Manual moderation (triggered by <@${interaction.user.id}>)`,
  };

  const window = `last ${days ?? 14} day${(days ?? 14) === 1 ? "" : "s"}`;

  if (jail) {
    const { status } = await DeleteUserMessagesService.jailUser(params);

    if (status === "no-jail-role" && !purge) {
      return {
        success: false,
        error:
          "This server has no jail role configured (check STATUS_ROLES), so nobody was jailed.",
      };
    }

    if (purge)
      DeleteUserMessagesService.deleteUserMessages(params).catch(() => {});

    const jailPart =
      status === "no-jail-role"
        ? "This server has no jail role configured (check STATUS_ROLES), so they were not jailed."
        : "User jailed.";

    return {
      success: true,
      message: purge
        ? `${jailPart} Deleting their messages from the ${window} in the background.`
        : `${jailPart} No messages were deleted.`,
    };
  }

  DeleteUserMessagesService.deleteUserMessages(params).catch(() => {});
  return {
    success: true,
    message: `Deleting their messages from the ${window} in the background.`,
  };
}
