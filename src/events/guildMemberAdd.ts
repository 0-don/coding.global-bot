import { PrismaClient } from '@prisma/client';
import type { GuildMember } from 'discord.js';
import { joinRole } from '../utils/members/joinRole';
import { updateUserCount } from '../utils/members/updateUserCount';

const prisma = new PrismaClient();

export default {
  name: 'guildMemberAdd',
  once: false,
  async execute(member: GuildMember) {
    // check user if exists
    const dbUser = await prisma.user.findFirst({
      where: { userId: { equals: member.id } },
      include: { roles: true },
    });

    if (!dbUser) {
      // create user
      await prisma.user.create({
        data: {
          userId: member.id,
          username: member.user.username,
          guildId: member.guild.id,
        },
      });
    } else {
      // add user roles if left prevously
      for (let role of dbUser.roles) {
        await member.roles.add(role.roleId);
      }
    }

    await joinRole(member);
    await updateUserCount(member);
  },
};
