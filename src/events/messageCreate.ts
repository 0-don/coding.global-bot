import type { Event } from '../types/index.js';
import { replyChatGPT } from '../utils/chatgpt/replyChatGPT.js';
import { addMessageDb } from '../utils/messages/addMessageDb.js';
import { checkWarnings } from '../utils/messages/checkWarnings.js';
import { cleanUpVerifyChannel } from '../utils/messages/cleanUpVerifyChannel.js';
import { translateReply } from '../utils/messages/translateReply.js';

export default {
  name: 'messageCreate',
  once: false,
  async execute(message) {
    // remove regular messages in verify channel
    await cleanUpVerifyChannel(message);

    //delete messages with links
    await checkWarnings(message);

    //reply to messages with /ai
    await replyChatGPT(message);

    // translate message
    await translateReply(message);

    // add Message to Database for statistics
    await addMessageDb(message);
  },
} as Event<'messageCreate'>;
