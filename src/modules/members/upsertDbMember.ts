import type { Prisma } from '@prisma/client';
import type { GuildMember, PartialGuildMember } from 'discord.js';
import { prisma } from '../../prisma.js';

export const upsertDbMember = async (
  member: GuildMember | PartialGuildMember,
  status: 'join' | 'leave'
) => {
  // dont add bots to the list
  if (member.user.bot) return;

  // get member info
  const memberId = member.id;
  const guildId = member.guild.id;
  const username = member.user.username;

  // create member db input
  const dbMemberInput: Prisma.MemberCreateInput = {
    memberId,
    username,
  };

  // create or update member, fetch roles if exist
  const dbMember = await prisma.member.upsert({
    where: { memberId: dbMemberInput.memberId },
    create: dbMemberInput,
    update: dbMemberInput,
    include: { roles: true },
  });

  // create member guild db input
  const dbMemberGuildInput: Prisma.MemberGuildUncheckedCreateInput = {
    memberId,
    guildId,
    status: status === 'join' ? true : false,
  };

  // create or update member guild
  await prisma.memberGuild.upsert({
    where: { member_guild: { memberId, guildId } },
    create: dbMemberGuildInput,
    update: dbMemberGuildInput,
  });

  // if user joined and already has db roles assign them
  if (status === 'join' && dbMember.roles.length)
    for (let role of dbMember.roles) {
      if (member.roles.cache.has(role.roleId)) continue;
      await member.roles.add(role.roleId);
    }

  // return user
  return dbMember;
};
