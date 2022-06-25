import type { GuildMember } from 'discord.js';

export const updateUserCount = async (member: GuildMember) => {
  const memberCountChannel = member.guild.channels.cache.find((channel) =>
    channel.name.includes('Members:')
  );

  if (!memberCountChannel) return;

  const memberCount = member.guild.memberCount;
  const botCount = member.guild.members.cache.filter(
    (member) => !member.user.bot
  ).size;

  console.log(memberCount, botCount);
  await memberCountChannel.setName(`Members: ${memberCount - botCount}`);
};
