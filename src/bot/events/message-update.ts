import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";
import { ThreadService } from "@/core/services/threads/thread.service";

@Discord()
export class MessageUpdate {
  @On({ event: "messageUpdate" })
  async messageUpdate(
    [oldMessage, newMessage]: ArgsOf<"messageUpdate">,
    client: Client,
  ) {
    // Only handle messages in threads
    if (!newMessage.channel.isThread()) return;

    // Fetch full message if partial
    const message = newMessage.partial
      ? await newMessage.fetch().catch(() => null)
      : newMessage;

    if (!message) return;

    // Update the reply in the database
    await ThreadService.upsertReply(message);
  }
}
