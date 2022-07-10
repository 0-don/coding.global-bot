import type { Message } from 'discord.js';
import { translate } from '../helpers';

export const translateReply = async (message: Message<boolean>) => {
  if (
    message.type === 'REPLY' &&
    message.reference?.messageId &&
    message.content === '/translate'
  ) {
    const replyMsg = await message.channel.messages.fetch(
      message.reference?.messageId
    );

    await message.delete();
    message.channel.send(await translate(replyMsg.content));
  }
};
