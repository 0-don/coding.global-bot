import { Message, MessageType, TextChannel } from 'discord.js';
import { translate } from '../helpers.js';

export const translateReply = async (message: Message<boolean>) => {
  if (
    message.type === MessageType.Reply &&
    message.reference?.messageId &&
    message.content === '/translate'
  ) {
    const channel = (await message.channel.fetch()) as TextChannel;

    const replyMsg = await channel.messages.fetch(message.reference?.messageId);

    await message.delete();

    channel.send({
      content: await translate(
        Buffer.from(replyMsg.content, 'utf-8').toString()
      ),
      allowedMentions: { users: [] },
    });
  }
};
