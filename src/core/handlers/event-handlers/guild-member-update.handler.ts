import type { GuildMember, PartialGuildMember } from "discord.js";
import { EVERYONE } from "@/shared/config/roles";
import { MemberUpdateQueueService } from "@/core/services/members/member-update-queue.service";
import { MembersService } from "@/core/services/members/members.service";
import { RolesService } from "@/core/services/roles/roles.service";
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

  MemberUpdateQueueService.queueMemberUpdate(newMember.id, newMember.guild.id);
}
