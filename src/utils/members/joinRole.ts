import type { GuildMember } from 'discord.js';
import type { StatusRoles } from '../../types/types';
import { statusRoles } from '../constants';

export const joinRole = async (member: GuildMember) => {
  await member.fetch();

  // this status role will be given on new memeber join if he has no role
  const unverifiedRole = member.roles.cache.find(
    ({ name }) => name === ('unverified' as StatusRoles)
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
