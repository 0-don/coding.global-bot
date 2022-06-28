import type { GuildMember } from 'discord.js';

export const updateUserCount = async (member: GuildMember) => {
  const memberCountChannel = member.guild.channels.cache.find((channel) =>
    channel.name.includes('Members:')
  );

  if (!memberCountChannel) return;

  await member.guild.members.fetch();

  const memberCount = member.guild.members.cache.filter(
    (member) => !member.user.bot
  ).size;

  await memberCountChannel.setName(`Members: ${memberCount}`);
};
