import { PrismaClient } from '@prisma/client';
import type { GuildMember, PartialGuildMember } from 'discord.js';

const prisma = new PrismaClient();

export const upsertDbMember = async (
  member: GuildMember | PartialGuildMember
) => {
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
};
