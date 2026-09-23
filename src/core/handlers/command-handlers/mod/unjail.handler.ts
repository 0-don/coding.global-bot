import { DeleteUserMessagesService } from "@/core/services/messages/delete-user-messages.service";
import { db } from "@/lib/db";
import { modLog } from "@/lib/db-schema";
import type { CommandResult } from "@/types";
import type { CommandInteraction, Guild, User } from "discord.js";
import { and, desc, eq } from "drizzle-orm";

/**
 * Whether this moderator may release someone the jail log says a superior put
 * away.
 *
 * Deliberately not the mirror of jail's rank check. Jailing strips the member's
 * roles, so by the time anyone runs /unjail the target's highest role is the
 * jail role itself - comparing against it would clear every moderator every
 * time and check nothing at all. The rank that still means something is the one
 * belonging to whoever ordered the jail, so that is what gets weighed.
 *
 * Returns the refusal to show, or null when the release may proceed.
 */
async function refuseByJailerRank(
  guild: Guild,
  invokerId: string,
  targetId: string,
): Promise<string | null> {
  // The owner outranks everyone, so there is nothing to weigh.
  if (invokerId === guild.ownerId) return null;

  const [lastJail] = await db
    .select({ moderatorId: modLog.moderatorId })
    .from(modLog)
    .where(
      and(
        eq(modLog.guildId, guild.id),
        eq(modLog.targetId, targetId),
        eq(modLog.action, "jail"),
      ),
    )
    .orderBy(desc(modLog.createdAt))
    .limit(1);

  // No recorded jailer, so no rank to defer to. Covers automod jails, which
  // carry no moderator by design, and anyone jailed before manual-jail logging
  // existed - refusing those would strand them in jail with nobody able to
  // release them, which is worse than the privilege it would protect.
  if (!lastJail?.moderatorId) return null;

  // Undoing your own decision is always allowed.
  if (lastJail.moderatorId === invokerId) return null;

  if (lastJail.moderatorId === guild.ownerId) {
    return "You cannot release someone the server owner jailed.";
  }

  const jailer = await guild.members
    .fetch(lastJail.moderatorId)
    .catch(() => null);

  // The jailer has since left, so their rank no longer exists to be outranked.
  if (!jailer) return null;

  const invoker = await guild.members.fetch(invokerId).catch(() => null);
  if (!invoker)
    return "I could not check your roles, so I have not released anyone.";

  if (jailer.roles.highest.position >= invoker.roles.highest.position) {
    return "You cannot release someone jailed by a moderator whose highest role is equal to or above your own.";
  }

  return null;
}

export async function executeUnjail(
  interaction: CommandInteraction,
  user: User | undefined,
  userId: string | undefined,
  reason: string | undefined,
): Promise<CommandResult> {
  const memberId = user?.id ?? userId;
  if (!memberId || !interaction.guild) {
    return { success: false, error: "Invalid user or guild" };
  }

  const refusal = await refuseByJailerRank(
    interaction.guild,
    interaction.user.id,
    memberId,
  );
  if (refusal) return { success: false, error: refusal };

  const result = await DeleteUserMessagesService.unjailUser({
    guild: interaction.guild,
    memberId,
    user: user ?? null,
    moderatorId: interaction.user.id,
    moderatorName: interaction.user.username,
    // A reason replaces the fallback rather than being appended to it. The
    // suffix dates from before moderatorId was recorded, when the free text was
    // the only place a moderator appeared; now that it has its own line in the
    // embed, appending it to a real reason just said the same thing twice.
    // The fallback still names them, because "No reason provided" on its own
    // tells you nothing.
    reason: reason ?? `Released by <@${interaction.user.id}>`,
  });

  if (!result.ok) return { success: false, error: result.message };

  return { success: true, message: result.message };
}
