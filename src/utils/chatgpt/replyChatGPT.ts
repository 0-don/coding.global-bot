import { Message, MessageType, TextChannel } from 'discord.js';
import { chunkedSend } from '../messages/chunkedSend.js';
import { askChatGPT } from './askChatGPT.js';

export const replyChatGPT = async (message: Message<boolean>) => {
  if (
    (message.type === MessageType.Reply &&
      message.reference?.messageId &&
      message.content === '/ai') ||
    (message.type === MessageType.Reply &&
      message.reference?.messageId &&
      message.content === '/gpt')
  ) {
    const channel = (await message.channel.fetch()) as TextChannel;

    const replyMsg = await channel.messages.fetch(message.reference?.messageId);

    const user = replyMsg.author;

    const content = await askChatGPT({ text: replyMsg.content, user });

    console.log(content?.length);

    if (!content) return;

    await chunkedSend({ content, channel: message.channel as TextChannel });
  }
};
