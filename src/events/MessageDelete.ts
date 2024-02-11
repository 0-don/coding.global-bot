import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";
import { MessagesService } from "../lib/messages/Messages.service.js";

@Discord()
export class MessageDelete {
  @On()
  async messageDelete([message]: ArgsOf<"messageDelete">, client: Client) {
    MessagesService.deleteMessageDb(message);
    
    if (!message.guild) return; // Make sure this is not a DM

    MessagesService.saveDeletedMessageHistory(message);
  }
}
