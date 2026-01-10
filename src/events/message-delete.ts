import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";
import { MessagesService } from "../lib/messages/messages.service";
import { ThreadService } from "../lib/threads/thread.service";

@Discord()
export class MessageDelete {
  @On()
  async messageDelete([message]: ArgsOf<"messageDelete">, client: Client) {
    MessagesService.deleteMessageDb(message);

    // Delete from ThreadReply table if it's a thread message
    if (message.channel.isThread()) {
      await ThreadService.deleteReply(message.id);
    }

    if (!message.guild) return; // Make sure this is not a DM

    MessagesService.saveDeletedMessageHistory(message);
  }
}
