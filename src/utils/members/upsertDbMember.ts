import { Prisma, PrismaClient } from '@prisma/client';
import type { GuildMember, PartialGuildMember } from 'discord.js';

const prisma = new PrismaClient();

export const upsertDbMember = async (
  member: GuildMember | PartialGuildMember
) => {
  // dont add bots to the list
  if (member.user.bot) return;

  const dbMemberInput: Prisma.MemberCreateInput = {
    memberId: member.id,
    guildId: member.guild.id,
    username: member.user.username,
    guildName: member.guild.name,
  };

  const dbMember = await prisma.member.upsert({
    where: { memberId: dbMemberInput.memberId },
    create: dbMemberInput,
    update: dbMemberInput,
    include: { roles: true },
  });

  if (dbMember.roles.length)
    for (let role of dbMember.roles) await member.roles.add(role.roleId);

  return dbMember;
};
