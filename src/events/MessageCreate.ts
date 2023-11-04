import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";
import { MessagesModule } from "../modules/messages/Messages.module.js";
import { checkWarnings } from "../modules/messages/checkWarnings.js";
import { translateReply } from "../modules/messages/translateReply.js";
import { replyChatGPT } from "../utils/chatgpt/replyChatGPT.js";

@Discord()
export class MessageCreate {
  @On()
  async messageCreate([message]: ArgsOf<"messageCreate">, client: Client) {
    // remove regular messages in verify channel
    await MessagesModule.cleanUpVerifyChannel(message);

    //delete messages with links
    await checkWarnings(message);

    //reply to messages with /ai
    await replyChatGPT(message);

    // translate message
    await translateReply(message);

    // add Message to Database for statistics
    await MessagesModule.addMessageDb(message);
  }
}
