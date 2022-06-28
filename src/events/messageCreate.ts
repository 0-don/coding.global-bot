import type { Message, TextChannel } from 'discord.js';

export default {
  name: 'messageCreate',
  once: false,
  async execute(message: Message<boolean>) {
    const channel = (await message.channel?.fetch()) as TextChannel;
    // remove non command messages in verify channel
    if (channel.name === 'verify' && message.type !== 'APPLICATION_COMMAND') {
      message.delete();
    }
  },
};
