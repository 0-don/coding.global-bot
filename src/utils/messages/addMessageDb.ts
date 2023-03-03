import type { Message } from 'discord.js';
import { prisma } from '../../prisma.js';

export const addMessageDb = async (message: Message<boolean>) => {
  // check if disboard bump command was used

  // get info
  const content = message.content;
  const memberId = message.member?.user.id;
  const channelId = message.channelId;
  const messageId = message.id;
  const guildId = message.guild?.id;

  // if info doesnt exist
  if (!content || !guildId || !memberId || message.interaction?.user.bot)
    return;

  // catch message edits
  try {
    await prisma.memberMessages.upsert({
      where: { messageId },
      create: { channelId, guildId, memberId, messageId },
      update: { channelId, guildId, memberId, messageId },
    });
  } catch (_) {}
};
