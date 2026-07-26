import type { GuildMember, PartialGuildMember } from "discord.js";
import { EVERYONE, JAIL } from "@/shared/config/roles";
import { MemberUpdateQueueService } from "@/core/services/members/member-update-queue.service";
import { MembersService } from "@/core/services/members/members.service";
import { RolesService } from "@/core/services/roles/roles.service";
import { db } from "@/lib/db";
import { memberGuild, memberRole } from "@/lib/db-schema";
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

  const jailRole = guildRoles.find((role) => role.name === JAIL);
  if (jailRole) {
    const wasJailed = oldRoles.some((role) => role.id === jailRole.id);
    const isStillJailed = newRoles.some((role) => role.id === jailRole.id);
    if (wasJailed && !isStillJailed) {
      const mg = await db.query.memberGuild.findFirst({
        where: and(
          eq(memberGuild.memberId, newMember.id),
          eq(memberGuild.guildId, newMember.guild.id),
        ),
      });
      if (mg?.preJailDisplayName !== undefined) {
        await newMember.setNickname(mg.preJailDisplayName).catch(() => {});
        await db
          .update(memberGuild)
          .set({ preJailDisplayName: null })
          .where(
            and(
              eq(memberGuild.memberId, newMember.id),
              eq(memberGuild.guildId, newMember.guild.id),
            ),
          )
          .catch(() => {});
      }
    }
  }

  MemberUpdateQueueService.queueMemberUpdate(newMember.id, newMember.guild.id);
}
