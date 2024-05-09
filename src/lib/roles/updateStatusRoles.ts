import type { GuildMember, PartialGuildMember } from "discord.js";
import { prisma } from "../../prisma.js";
import { StatusRoles } from "../../types/index.js";
import { EVERYONE, JAIL, STATUS_ROLES } from "../constants.js";

export const updateStatusRoles = async (
  oldMember: GuildMember | PartialGuildMember,
  newMember: GuildMember | PartialGuildMember
) => {
  // get old roles as string[]
  const oldRoles = oldMember.roles.cache
    .filter(({ name }) => name !== EVERYONE)
    .map((role) => role.name);
  // get new roles as string[]
  const newRoles = newMember.roles.cache
    .filter(({ name }) => name !== EVERYONE)
    .map((role) => role.name);

  // onboarding question bypass
  if (oldMember.flags.bitfield === 9 && newMember.flags.bitfield === 11) {
    const dbRoles = await prisma.memberRole.findMany({
      where: {
        memberId: newMember.id,
        guildId: newMember.guild.id,
      },
    });

    if (dbRoles.length) {
      //remove all roles
      for (const role of newMember.roles.cache.values()) {
        const foundRole = dbRoles.find((dbRole) => dbRole.roleId === role.id);
        if (!foundRole) newMember.roles.remove(role).catch(() => {});
      }

      // add roles that are missing
      for (const dbRole of dbRoles) {
        const role = newMember.guild.roles.cache.find(
          (role) => role.id === dbRole.roleId
        );
        if (role) newMember.roles.add(role).catch(() => {});
      }
    }
    return;
  }
  // only run if user has a new role
  if (oldRoles.length >= newRoles.length) return;

  const newAddedRole = newRoles.find(
    (role) => !oldRoles.includes(role)
  ) as StatusRoles;

  if (newRoles.includes(JAIL) && !STATUS_ROLES.includes(newAddedRole)) {
    // remove all roles expect jail
    for (const role of newMember.roles.cache.values()) {
      if (role.name !== JAIL) newMember.roles.remove(role).catch(() => {});
    }
    return prisma.memberRole.deleteMany({
      where: {
        memberId: newMember.id,
        guildId: newMember.guild.id,
        roleId: {
          not: newMember.roles.cache.find((role) => role.name === JAIL)?.id,
        },
      },
    });
  }

  // check if role is a status role if yes then remove the unused status role
  if (STATUS_ROLES.includes(newAddedRole)) {
    const unusedRoles = STATUS_ROLES.filter((role) => newAddedRole !== role);
    unusedRoles.forEach((roleName) => {
      const role = newMember.roles.cache.find((r) => r.name === roleName);
      if (role) newMember.roles.remove(role);
    });
  }
};
