import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";
import { MessagesService } from "../lib/messages/Messages.service.js";

@Discord()
export class MessageDelete {
  @On()
  async messageDelete([message]: ArgsOf<"messageDelete">, client: Client) {
    await MessagesService.deleteMessageDb(message);
  }
}
