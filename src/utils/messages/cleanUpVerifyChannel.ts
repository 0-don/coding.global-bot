import { Message, MessageType, TextChannel } from 'discord.js';
import { VERIFY_CHANNEL } from '../constants';

export const cleanUpVerifyChannel = async (message: Message<boolean>) => {
  const channel = (await message.channel?.fetch()) as TextChannel;
  // remove non command messages in verify channel
  if (
    channel.name === VERIFY_CHANNEL &&
    message.type !== MessageType.ChatInputCommand
  ) {
    message.delete();
  }
};
