import type { GuildMember } from 'discord.js';

export const joinRole = async (member: GuildMember) => {
  const unverifiedRole = member.guild?.roles.cache.find(
    (role) => role.name === 'unverified'
  );

  if (!unverifiedRole) return;

  await member.roles.add(unverifiedRole);
};
