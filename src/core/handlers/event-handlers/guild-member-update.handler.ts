import type { GuildMember, PartialGuildMember } from "discord.js";
import { EVERYONE } from "@/shared/config/roles";
import { MemberUpdateQueueService } from "@/core/services/members/member-update-queue.service";
import { MembersService } from "@/core/services/members/members.service";
import { RolesService } from "@/core/services/roles/roles.service";
import {
  AuditLogEvent,
  findAuditActor,
} from "@/core/services/moderation/audit-log";
import { ModLogService } from "@/core/services/moderation/modlog.service";
import { db } from "@/lib/db";
import { memberRole } from "@/lib/db-schema";
import { and, eq } from "drizzle-orm";

export async function handleGuildMemberUpdate(
  oldMember: GuildMember | PartialGuildMember,
  newMember: GuildMember,
): Promise<void> {
  const guildRoles = newMember.guild.roles.cache;
  const memberDbRoles = await db.query.memberRole.findMany({
    where: and(
      eq(memberRole.memberId, newMember.id),
      eq(memberRole.guildId, newMember.guild.id),
    ),
  });

  const oldRoles = oldMember.roles.cache
    .filter(({ name }) => name !== EVERYONE)
    .map((role) => role);

  const newRoles = newMember.roles.cache
    .filter(({ name }) => name !== EVERYONE)
    .map((role) => role);

  await RolesService.updateDbRoles({
    oldMember,
    newMember,
    oldRoles,
    newRoles,
    guildRoles,
    memberDbRoles,
  });

  await RolesService.updateStatusRoles({
    oldMember,
    newMember,
    oldRoles,
    newRoles,
    guildRoles,
    memberDbRoles,
  });

  MembersService.updateNickname(oldMember, newMember);

  logTimeoutChange(oldMember, newMember).catch(() => {});

  MemberUpdateQueueService.queueMemberUpdate(newMember.id, newMember.guild.id);
}

/**
 * Log a timeout set or lifted from Discord's own member menu.
 *
 * /mute and /unmute write their own entry with the moderator's name, so
 * changes the bot made are skipped. Discord has no timeout event: it is a
 * field change on guildMemberUpdate, attributed through the audit log.
 */
async function logTimeoutChange(
  oldMember: GuildMember | PartialGuildMember,
  newMember: GuildMember,
): Promise<void> {
  // A partial old member has no timeout field to compare against.
  if (oldMember.partial) return;

  const before = oldMember.communicationDisabledUntilTimestamp ?? null;
  const after = newMember.communicationDisabledUntilTimestamp ?? null;

  if (before === after) return;

  // An expiring timeout also clears the field, but nobody did that - only
  // report a removal while it was still in force.
  const wasActive = before !== null && before > Date.now();
  const isActive = after !== null && after > Date.now();

  if (!isActive && !wasActive) return;

  const action = isActive ? "timeout" : "untimeout";

  const actor = await findAuditActor(
    newMember.guild,
    AuditLogEvent.MemberUpdate,
    newMember.id,
  );

  const botId = newMember.client.user?.id;
  if (actor?.moderatorId && botId && actor.moderatorId === botId) return;

  if (
    await ModLogService.alreadyLoggedRecently(
      newMember.guild.id,
      newMember.id,
      action,
    )
  )
    return;

  await ModLogService.postLog({
    guild: newMember.guild,
    action,
    targetId: newMember.id,
    targetName: newMember.user.username,
    targetUser: newMember.user,
    moderatorId: actor?.moderatorId,
    moderatorName: actor?.moderatorName,
    reason: isActive
      ? `${actor?.reason ?? "No reason provided"} (until <t:${Math.floor((after as number) / 1000)}:f>)`
      : actor?.reason,
  });
}
