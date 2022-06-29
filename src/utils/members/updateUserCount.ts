import type { GuildMember } from 'discord.js';
import { MEMBERS_COUNT_CHANNEL } from '../constants';

export const updateUserCount = async (member: GuildMember) => {
  const memberCountChannel = member.guild.channels.cache.find((channel) =>
    channel.name.includes(MEMBERS_COUNT_CHANNEL)
  );

  if (!memberCountChannel) return;

  await member.guild.members.fetch();

  const memberCount = member.guild.members.cache.filter(
    (member) => !member.user.bot
  ).size;

  await memberCountChannel.setName(`${MEMBERS_COUNT_CHANNEL} ${memberCount}`);
};
