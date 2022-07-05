import { Prisma, PrismaClient } from '@prisma/client';
import type { GuildMember } from 'discord.js';
import { upsertDbMember } from './upsertDbMember';

const prisma = new PrismaClient();

export const guildMemberAddDb = async (member: GuildMember): Promise<any> => {
  const dbMember = await prisma.member.findFirst({
    where: { memberId: member.id },
  });

  if (!dbMember) {
    await upsertDbMember(member);
    return await guildMemberAddDb(member);
  }

  const memberId = dbMember.memberId;
  const guildId = member.guild.id;
  const date = member.joinedAt ?? new Date();

  const guildMemberAdd: Prisma.GuildMemberAddUncheckedCreateInput = {
    memberId,
    guildId,
    date,
  };

  return await prisma.guildMemberAdd.upsert({
    where: { member_guild_date: { memberId, guildId, date } },
    create: guildMemberAdd,
    update: guildMemberAdd,
  });
};
