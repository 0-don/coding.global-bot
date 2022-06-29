import type { GuildMember } from 'discord.js';
import { StatusRoles, statusRoles } from '../../types/types';

export const joinRole = async (member: GuildMember) => {
  await member.fetch();

  const unverifiedRole = member.roles.cache.find(
    (role) => role.name === 'unverified'
  );

  // if status role on user then exit
  if (
    member.roles.cache.some((role) =>
      statusRoles.includes(role.name as StatusRoles)
    ) ||
    !unverifiedRole
  )
    return;

  // if first time member add unverified role
  await member.roles.add(unverifiedRole);
};
