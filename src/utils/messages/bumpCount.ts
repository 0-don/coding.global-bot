import { PrismaClient } from '@prisma/client';
import type { Message } from 'discord.js';

const prisma = new PrismaClient();

export const bumpCount = async (message: Message<boolean>) => {
  if (
    message.interaction?.type !== 'APPLICATION_COMMAND' ||
    message.interaction?.commandName !== 'bump'
  )
    return;

  const memberId = message.interaction.user.id;
  const guildId = message.guild?.id;

  if (!guildId) return;

  const memberBump = await prisma.memberBump.findFirst({
    where: { memberId, guildId },
  });

  if (!memberBump) {
    await prisma.memberBump.create({
      data: { memberId, guildId, count: 1 },
    });
  } else {
    await prisma.memberBump.update({
      where: { member_guild: { memberId, guildId } },
      data: { count: memberBump.count + 1 },
    });
  }
};
