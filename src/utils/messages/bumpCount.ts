import { PrismaClient } from '@prisma/client';
import type { Message } from 'discord.js';

const prisma = new PrismaClient();

export const bumpCount = async (message: Message<boolean>) => {
  if (
    message.interaction?.type !== 'APPLICATION_COMMAND' &&
    message.interaction?.commandName !== 'bump'
  )
    return;

  const memberBump = await prisma.memberBump.findFirst({
    where: {
      memberId: message.author.id,
      guildId: message.guild?.id,
    },
  });

  if (!memberBump) {
    await prisma.memberBump.create({
      data: {
        memberId: message.author.id,
        guildId: message.guild!.id,
        count: 1,
        guildName: message.guild!.name,
        username: message.author.username,
      },
    });
  } else {
    await prisma.memberBump.update({
      where: {
        member_guild: {
          memberId: message.author.id,
          guildId: message.guild!.id,
        },
      },
      data: {
        count: memberBump.count + 1,
      },
    });
  }
};
