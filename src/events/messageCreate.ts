import type { Message } from 'discord.js';
import { bumpCount } from '../utils/messages/bumpCount';
import { cleanUpVerifyChannel } from '../utils/messages/cleanUpVerifyChannel';
import { translateReply } from '../utils/messages/translateReply';

export default {
  name: 'messageCreate',
  once: false,
  async execute(message: Message<boolean>) {
    // remove regular messages in verify channel
    await cleanUpVerifyChannel(message);

    // count bumps for the user
    await bumpCount(message);

    // translate message
    await translateReply(message);
  },
};
