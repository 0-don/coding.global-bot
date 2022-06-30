import { Member, MemberRole, PrismaClient } from '@prisma/client';
import type { GuildMember, PartialGuildMember } from 'discord.js';

const prisma = new PrismaClient();

export const upsertDbMember = async (
  member: GuildMember | PartialGuildMember
) => {
  let dbMember:
    | (Member & {
        roles: MemberRole[];
      })
    | null;

  // check user if exists
  dbMember = await prisma.member.findFirst({
    where: { memberId: member.id },
    include: { roles: true },
  });

  if (!dbMember) {
    // create user
    dbMember = await prisma.member.create({
      data: {
        memberId: member.id,
        username: member.user.username,
        guildId: member.guild.id,
      },
      include: { roles: true },
    });
  } else {
    // add user roles if left prevously
    for (let role of dbMember.roles) await member.roles.add(role.roleId);
  }

  return dbMember;
};
