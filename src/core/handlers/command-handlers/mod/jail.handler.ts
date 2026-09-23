import { DeleteUserMessagesService } from "@/core/services/messages/delete-user-messages.service";
import type { CommandResult } from "@/types";
import type { CommandInteraction, Guild, User } from "discord.js";

/**
 * Whether this moderator outranks the member they are trying to jail.
 *
 * Manage Roles is a single permission, so without this any moderator can jail
 * any other - or an administrator, or themselves. Discord gates its own role
 * actions on the acting member's highest role sitting above the target's, and
 * moderation should read the same way rather than inventing a second rule.
 *
 * Returns the refusal to show, or null when the jail may proceed.
 */
async function refuseByRank(
  guild: Guild,
  invokerId: string,
  targetId: string,
): Promise<string | null> {
  if (invokerId === targetId) return "You cannot jail yourself.";

  const target = await guild.members.fetch(targetId).catch(() => null);

  // Not in the server: there are no roles to weigh, and the jail is only a
  // database record until they return.
  if (!target) return null;

  // The bot's own position is a separate limit from the moderator's. Ignoring
  // it half-jails the member - they gain the jail role while keeping every
  // role the bot could not strip - which is worse than refusing outright.
  if (!target.manageable) {
    return "I cannot jail that member - their highest role sits above mine, so I cannot remove their roles.";
  }

  // The owner outranks everyone, including anyone whose roles say otherwise.
  if (invokerId === guild.ownerId) return null;

  const invoker = await guild.members.fetch(invokerId).catch(() => null);
  if (!invoker)
    return "I could not check your roles, so I have not jailed anyone.";

  if (target.roles.highest.position >= invoker.roles.highest.position) {
    return "You cannot jail someone whose highest role is equal to or above your own.";
  }

  return null;
}

export async function executeJail(
  interaction: CommandInteraction,
  user: User | undefined,
  userId: string | undefined,
  reason: string | undefined,
  deleteMessages: boolean = true,
  days: number | undefined = undefined,
): Promise<CommandResult> {
  const memberId = user?.id ?? userId;
  if (!memberId || !interaction.guild) {
    return { success: false, error: "Invalid user or guild" };
  }

  const refusal = await refuseByRank(
    interaction.guild,
    interaction.user.id,
    memberId,
  );
  if (refusal) return { success: false, error: refusal };

  const params = {
    guild: interaction.guild,
    memberId,
    jail: true,
    user: user ?? null,
    deleteMessages,
    days,
    moderatorId: interaction.user.id,
    moderatorName: interaction.user.username,
    // Same rule as /unjail: a reason stands on its own, and only the fallback
    // names the moderator. Appending them to a stated reason repeated the
    // Moderator line of the log embed, and the reason is shown to the member in
    // the jail channel too, where the suffix read oddly.
    reason: reason ?? `Jailed by <@${interaction.user.id}>`,
  };

  const { alreadyJailed } = await DeleteUserMessagesService.jailUser(params);

  // Refused rather than repeated: a second jail cannot punish them further,
  // and logging it again would put two jails in the mod log for one.
  if (alreadyJailed) {
    return {
      success: false,
      error:
        "That member is already jailed. Use /delete-user-messages if you need to delete more of their messages.",
    };
  }

  if (!deleteMessages) {
    return { success: true, message: "User jailed. No messages were deleted." };
  }

  DeleteUserMessagesService.deleteUserMessages(params).catch(() => {});

  const window = `last ${days ?? 14} day${(days ?? 14) === 1 ? "" : "s"}`;

  return {
    success: true,
    message: `Member jailed. Deleting their messages from the ${window} in the background.`,
  };
}
