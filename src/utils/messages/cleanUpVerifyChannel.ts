import type { Message, TextChannel } from 'discord.js';

export const cleanUpVerifyChannel = async (message: Message<boolean>) => {
  const channel = (await message.channel?.fetch()) as TextChannel;
  // remove non command messages in verify channel
  if (channel.name === 'verify' && message.type !== 'APPLICATION_COMMAND') {
    message.delete();
  }
};
