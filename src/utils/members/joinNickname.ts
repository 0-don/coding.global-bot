import type { GuildMember, PartialGuildMember } from 'discord.js';
import { prisma } from '../../prisma.js';

export const joinSettings = async (
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

  if (guildMember) {
    try {
      await member.voice.setMute(guildMember.muted);
      await member.voice.setDeaf(guildMember.deafened);
      if (guildMember.nickname) await member.setNickname(guildMember.nickname);
    } catch (_) {}
  }
};
