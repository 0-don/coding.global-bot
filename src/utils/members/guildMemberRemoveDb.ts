import { Prisma, PrismaClient } from '@prisma/client';
import type { GuildMember } from 'discord.js';
import { upsertDbMember } from './upsertDbMember';

const prisma = new PrismaClient();

export const guildMemberRemoveDb = async (
  member: GuildMember
): Promise<any> => {
  const dbMember = await prisma.member.findFirst({
    where: { memberId: member.id },
  });

  if (!dbMember) {
    await upsertDbMember(member);
    return await guildMemberRemoveDb(member);
  }

  const memberId = dbMember.memberId;
  const guildId = member.guild.id;
  const date = new Date();

  const guildMemberRemove: Prisma.GuildMemberRemoveUncheckedCreateInput = {
    memberId,
    guildId,
    date,
  };

  return await prisma.guildMemberRemove.upsert({
    where: { member_guild_date: { memberId, guildId, date } },
    create: guildMemberRemove,
    update: guildMemberRemove,
  });
};
