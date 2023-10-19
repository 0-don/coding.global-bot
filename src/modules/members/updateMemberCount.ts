import type { GuildMember, PartialGuildMember } from 'discord.js';
import { MEMBERS_COUNT_CHANNEL } from '../constants.js';

export const updateMemberCount = async (
  member: GuildMember | PartialGuildMember
) => {
  // dont add bots to the list
  if (member.user.bot) return;

  // find member: channel
  const memberCountChannel = member.guild.channels.cache.find((channel) =>
    channel.name.includes(MEMBERS_COUNT_CHANNEL)
  );

  // if no channel return
  if (!memberCountChannel) return;

  // await member count
  await member.guild.members.fetch();

  // count members exc
  const memberCount = member.guild.members.cache.filter(
    (member) => !member.user.bot
  ).size;

  // set channel name as member count
  try {
    await memberCountChannel.setName(`${MEMBERS_COUNT_CHANNEL} ${memberCount}`);
  } catch (_) {}
};
