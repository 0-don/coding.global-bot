import { Message, MessageType } from 'discord.js';
import { translate } from '../helpers';

export const translateReply = async (message: Message<boolean>) => {
  if (
    message.type === MessageType.Reply &&
    message.reference?.messageId &&
    message.content === '/translate'
  ) {
    const replyMsg = await message.channel.messages.fetch(
      message.reference?.messageId
    );

    await message.delete();
    message.channel.send({
      content: await translate(
        Buffer.from(replyMsg.content, 'utf-8').toString()
      ),
      allowedMentions: { users: [] },
    });
  }
};
