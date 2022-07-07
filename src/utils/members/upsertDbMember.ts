import { Prisma, PrismaClient } from '@prisma/client';
import type { GuildMember, PartialGuildMember } from 'discord.js';

const prisma = new PrismaClient();

export const upsertDbMember = async (
  member: GuildMember | PartialGuildMember,
  status: 'join' | 'leave'
) => {
  // dont add bots to the list
  if (member.user.bot) return;

  const memberId = member.id;
  const guildId = member.guild.id;
  const username = member.user.username;

  const dbMemberInput: Prisma.MemberCreateInput = {
    memberId,
    username,
  };

  const dbMember = await prisma.member.upsert({
    where: { memberId: dbMemberInput.memberId },
    create: dbMemberInput,
    update: dbMemberInput,
    include: { roles: true },
  });

  const dbMemberGuildInput: Prisma.MemberGuildUncheckedCreateInput = {
    memberId,
    guildId,
    status: status === 'join' ? true : false,
  };

  await prisma.memberGuild.upsert({
    where: { member_guild: { memberId, guildId } },
    create: dbMemberGuildInput,
    update: dbMemberGuildInput,
  });

  if (status === 'join' && dbMember.roles.length)
    for (let role of dbMember.roles) {
      if (member.roles.cache.has(role.roleId)) continue;
      await member.roles.add(role.roleId);
    }

  return dbMember;
};
