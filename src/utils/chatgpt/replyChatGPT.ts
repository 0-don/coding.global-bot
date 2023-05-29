import { Message, MessageType, TextChannel } from 'discord.js';
import { memberRoles } from '../constants.js';
import { chunkedSend } from '../messages/chunkedSend.js';
import { fetchMessages } from '../messages/fetchMessages.js';
import { getTextFromImage } from '../tesseract/tesseract.js';
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

    const guildMember = await channel.guild.members.fetch(user.id);

    const channels = await channel.guild.channels.fetch();
    const botChannel = channels.find((channel) => channel?.name === 'bot');

    if (
      channel.name === 'general' &&
      !guildMember?.roles.cache.some((role) =>
        memberRoles.includes(role.name as any)
      )
    ) {
      return channel.send(`use this command in ${botChannel?.toString()}`);
    }

    const messages = await fetchMessages(channel, 500);
    const replyMsgIndex = messages.findIndex((msg) => msg.id === replyMsg.id);

    if (replyMsgIndex === -1) return await channel.send('Message not found');

    const userMessages: Message<boolean>[] = [replyMsg];

    // get before messages until we hit a message from a different user
    for (let i = replyMsgIndex - 1; i >= 0; i--) {
      const msg = messages[i] as Message<boolean>;
      if (msg.author.id === user.id) {
        userMessages.push(msg);
      } else {
        break;
      }
    }

    // get after messages until we hit a message from a different user
    for (let i = replyMsgIndex + 1; i <= messages.length; i++) {
      const msg = messages[i] as Message<boolean>;
      if (msg.author.id === user.id) {
        userMessages.push(msg);
      } else {
        break;
      }
    }

    const dateSortedMessages = userMessages.sort(
      (a, b) => a.createdTimestamp - b.createdTimestamp
    );

    const getAllImagesFromMessages = (
      await Promise.all(
        dateSortedMessages
          .map((msg) => msg.attachments.map((attachment) => attachment.url))
          .flat()
          .map((url) => getTextFromImage(url))
      )
    ).join('\n');

    const messagesContentArray = dateSortedMessages.map((msg) => msg.content);
    messagesContentArray.push(getAllImagesFromMessages);
    const messagesContent = messagesContentArray.join('\n');

    if (!messagesContent.length) return await channel.send('No messages found');

    const content = await askChatGPT({
      text: messagesContent,
      user,
      reply: true,
    });

    if (!content) return await channel.send('Chat GPT failed');

    return await chunkedSend({
      content,
      channel: message.channel as TextChannel,
    });
  }

  return;
};
