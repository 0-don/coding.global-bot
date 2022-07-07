import { Prisma, PrismaClient } from '@prisma/client';
import type { GuildMember } from 'discord.js';
import { EVERYONE } from '../constants';

const prisma = new PrismaClient();

export const recreateMemberDbRoles = async (member: GuildMember) => {
  const memberId = member.id;
  const guildId = member.guild.id;

  await prisma.memberRole.deleteMany({
    where: {
      memberId,
      guildId,
    },
  });

  if (member.user.bot) return;

  const roles: Prisma.MemberRoleUncheckedCreateInput[] = [];

  for (let roleCollection of member.roles.cache) {
    const role = roleCollection[1];

    if (role.name === EVERYONE) continue;
    if (!role.editable) continue;

    const memberRole: Prisma.MemberRoleUncheckedCreateInput = {
      roleId: role.id,
      memberId,
      guildId,
    };

    roles.push(memberRole);
  }

  await prisma.memberRole.createMany({ data: roles, skipDuplicates: true });
};
