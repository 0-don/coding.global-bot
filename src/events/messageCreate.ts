import { replyChatGPT } from "../modules/chatgpt/replyChatGPT.js";
import { addMessageDb } from "../modules/messages/addMessageDb.js";
import { checkWarnings } from "../modules/messages/checkWarnings.js";
import { cleanUpVerifyChannel } from "../modules/messages/cleanUpVerifyChannel.js";
import { translateReply } from "../modules/messages/translateReply.js";
import type { Event } from "../types/index.js";

export default {
  name: "messageCreate",
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
} as Event<"messageCreate">;
