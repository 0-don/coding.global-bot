import { MessagesService } from "@/core/services/messages/messages.service";
import { RecentMessagesService } from "@/core/services/messages/recent-messages.service";
import { ThreadService } from "@/core/services/threads/thread.service";
import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";

@Discord()
export class MessageDelete {
  @On()
  async messageDelete([message]: ArgsOf<"messageDelete">, client: Client) {
    MessagesService.deleteMessageDb(message);
    void RecentMessagesService.forget([message.id]);

    // Delete from ThreadReply table if it's a thread message
    if (message.channel.isThread()) {
      await ThreadService.deleteThreadMessage(message.id);
    }

    MessagesService.saveDeletedMessageHistory(message);
  }

  @On()
  async messageDeleteBulk([messages]: ArgsOf<"messageDeleteBulk">) {
    await RecentMessagesService.forget([...messages.keys()]);
  }
}
