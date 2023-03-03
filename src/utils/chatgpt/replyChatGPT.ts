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

    // split message into 4000 char chunks and send it
    if (content.length > 4000) {
      const splitContent = content.split(' ');

      const chunks = [];

      let currentChunk = '';

      for (const word of splitContent) {
        if (currentChunk.length + word.length > 3900) {
          chunks.push(currentChunk);
          currentChunk = '';
        }
        currentChunk += word + ' ';
      }

      chunks.push(currentChunk);

      for (const chunk of chunks) {
        await channel.send({
          content: chunk,
          allowedMentions: { users: [] },
        });
      }
      return;
    }

    await channel.send({
      content,
      allowedMentions: { users: [] },
    });
  }
};
