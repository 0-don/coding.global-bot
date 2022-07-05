import { Prisma, PrismaClient } from '@prisma/client';
import type { GuildMember } from 'discord.js';
import { EVERYONE } from '../constants';

const prisma = new PrismaClient();

export const createUserDbRoles = async (member: GuildMember) => {
  for (let roleCollection of member.roles.cache) {
    const role = roleCollection[1];

    if (role.name === EVERYONE) continue;
    if (member.user.bot) continue;

    const memberRole: Prisma.MemberRoleUncheckedCreateInput = {
      memberId: member.id,
      roleId: role.id,
    };

    await prisma.memberRole.upsert({
      where: {
        member_role: {
          memberId: memberRole.memberId,
          roleId: memberRole.roleId,
        },
      },
      create: memberRole,
      update: memberRole,
    });
  }
};
