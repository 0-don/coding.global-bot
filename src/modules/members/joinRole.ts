import type { GuildMember, PartialGuildMember } from 'discord.js';
import type { StatusRoles } from '../../types/index.js';
import { statusRoles } from '../constants.js';

export const joinRole = async (
  member: GuildMember | PartialGuildMember,
  role: StatusRoles
) => {
  // dont add bots to the list
  if (member.user.bot) return;

  await member.fetch();

  // this status role will be given on new memeber join if he has no role
  const addRole = member.guild.roles.cache.find(({ name }) => name === role);

  // if status role on user then exit
  if (
    member.roles.cache.some((role) =>
      statusRoles.includes(role.name as StatusRoles)
    ) ||
    !addRole
  )
    return;

  // if first time member add unverified role
  await member.roles.add(addRole);
};
