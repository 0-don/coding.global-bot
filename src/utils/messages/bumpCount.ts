import { PrismaClient } from '@prisma/client';
import type { Message } from 'discord.js';

const prisma = new PrismaClient();

export const bumpCount = async (message: Message<boolean>) => {
  // check if disboard bump command was used
  if (
    message.interaction?.type !== 'APPLICATION_COMMAND' ||
    message.interaction?.commandName !== 'bump'
  )
    return;

  // get member info
  const memberId = message.interaction.user.id;
  const guildId = message.guild?.id;

  // if guild somehow doesnt exist return
  if (!guildId) return;

  // get member bump info from db
  const memberBump = await prisma.memberBump.findFirst({
    where: { memberId, guildId },
  });

  // if no member bump create one, else update it +1
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
