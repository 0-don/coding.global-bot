import { MessagesService } from "@/core/services/messages/messages.service";
import { ThreadService } from "@/core/services/threads/thread.service";
import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";

@Discord()
export class MessageUpdate {
  @On({ event: "messageUpdate" })
  async messageUpdate(
    [oldMessage, newMessage]: ArgsOf<"messageUpdate">,
    client: Client,
  ) {
    const message = newMessage.partial
      ? await newMessage.fetch().catch(() => null)
      : newMessage;

    if (!message || !message.guild || message.author?.bot) return;

    if (oldMessage.content === message.content) return;

    await MessagesService.checkWarnings(message);

    if (message.channel.isThread()) {
      await ThreadService.upsertThreadMessage(message);
    }
  }
}
