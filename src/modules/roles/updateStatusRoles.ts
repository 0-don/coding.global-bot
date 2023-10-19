import type { GuildMember, PartialGuildMember } from 'discord.js';
import type { StatusRoles } from '../../types/index.js';
import { EVERYONE, statusRoles } from '../constants.js';
import { joinRole } from '../members/joinRole.js';

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

  // check if status role exist
  const activeStatusRoles = statusRoles.some((role) => newRoles.includes(role));

  // if somehow user has no STATUS role make him unverfied
  if (!newRoles.length || !activeStatusRoles)
    joinRole(newMember as GuildMember, 'unverified');
  // only run if user has a new role
  if (oldRoles.length >= newRoles.length) return;

  const newAddedRole = newRoles.filter(
    (role) => !oldRoles.includes(role)
  )[0] as StatusRoles;

  // check if role is a status role if yes then remove the unused status role
  if (statusRoles.includes(newAddedRole)) {
    const unusedRoles = statusRoles.filter((role) => newAddedRole !== role);
    unusedRoles.forEach((roleName) => {
      const role = newMember.roles.cache.find((r) => r.name === roleName);
      if (role) newMember.roles.remove(role);
    });
  }
};
