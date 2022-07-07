import type { GuildMember, PartialGuildMember } from 'discord.js';
import type { StatusRoles } from '../../types/types';
import { statusRoles, VERIFIED } from '../constants';

export const joinRole = async (member: GuildMember | PartialGuildMember) => {
  // dont add bots to the list
  if (member.user.bot) return;

  await member.fetch();

  // this status role will be given on new memeber join if he has no role
  const verifiedRole = member.guild.roles.cache.find(
    ({ name }) => name === VERIFIED
  );

  // if status role on user then exit
  if (
    member.roles.cache.some((role) =>
      statusRoles.includes(role.name as StatusRoles)
    ) ||
    !verifiedRole
  )
    return;

  // if first time member add unverified role
  await member.roles.add(verifiedRole);
};
