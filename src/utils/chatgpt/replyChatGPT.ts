import { Message, MessageType, TextChannel } from 'discord.js';
import { askChatGPT } from './askChatGPT.js';

export const replyChatGPT = async (message: Message<boolean>) => {
  if (
    message.type === MessageType.Reply &&
    message.reference?.messageId &&
    message.content === '/ai'
  ) {
    const channel = (await message.channel.fetch()) as TextChannel;

    const replyMsg = await channel.messages.fetch(message.reference?.messageId);

    const user = replyMsg.author;

    const content = await askChatGPT({ text: replyMsg.content, user });

    if (!content) return;

    await channel.send({
      content,
      allowedMentions: { users: [] },
    });
  }
};
