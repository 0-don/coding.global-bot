import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";
import { MessagesModule } from "../modules/messages/Messages.module.js";

@Discord()
export class MessageDelete {
  @On()
  async messageDelete([message]: ArgsOf<"messageDelete">, client: Client) {
    await MessagesModule.deleteMessageDb(message);
  }
}
