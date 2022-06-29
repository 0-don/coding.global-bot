import { PrismaClient } from '@prisma/client';
import type { GuildMember } from 'discord.js';
import { joinRole } from '../utils/members/joinRole';
import { updateUserCount } from '../utils/members/updateUserCount';

const prisma = new PrismaClient();

export default {
  name: 'guildMemberAdd',
  once: false,
  async execute(member: GuildMember) {
    const dbUser = await prisma.user.findFirst({
      where: { userId: { equals: member.id } },
    });

    if (!dbUser) {
      await prisma.user.create({
        data: {
          userId: member.id,
          username: member.user.username,
          guildId: member.guild.id,
        },
      });
    }

    await joinRole(member);
    await updateUserCount(member);
  },
};
