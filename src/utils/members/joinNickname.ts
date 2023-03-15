import type { GuildMember, PartialGuildMember } from 'discord.js';
import { prisma } from '../../prisma.js';

export const joinNickname = async (
  member: GuildMember | PartialGuildMember
) => {
  // dont add bots to the list
  if (member.user.bot) return;

  const guildMember = await prisma.memberGuild.findFirst({
    where: {
      guildId: member.guild.id,
      memberId: member.id,
    },
  });

  if (guildMember && guildMember.nickname) {
    await member.setNickname(guildMember.nickname);
  }
};
