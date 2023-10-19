import type { Message, PartialMessage } from 'discord.js';
import { prisma } from '../../prisma.js';

export const deleteMessageDb = async (
  message: Message<boolean> | PartialMessage
) => {
  // get info
  const messageId = message.id;

  // if info doesnt exist
  if (!messageId) return;

  try {
    await prisma.memberMessages.delete({
      where: { messageId },
    });
  } catch (_) {}
};
