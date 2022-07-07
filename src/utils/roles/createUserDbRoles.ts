import { Prisma, PrismaClient } from '@prisma/client';
import type { GuildMember } from 'discord.js';
import { EVERYONE } from '../constants';

const prisma = new PrismaClient();

export const createUserDbRoles = async (member: GuildMember) => {
  const memberId = member.id;
  const guildId = member.guild.id;

  await prisma.memberRole.deleteMany({
    where: {
      memberId,
      guildId,
    },
  });

  if (member.user.bot) return;

  for (let roleCollection of member.roles.cache) {
    const role = roleCollection[1];

    if (role.name === EVERYONE) continue;
    if (!role.editable) continue;

    const memberRole: Prisma.MemberRoleUncheckedCreateInput = {
      roleId: role.id,
      memberId,
      guildId,
    };

    await prisma.memberRole.upsert({
      where: {
        member_role: {
          memberId,
          roleId: memberRole.roleId,
        },
      },
      create: memberRole,
      update: memberRole,
    });
  }
};
