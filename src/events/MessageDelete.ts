import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";
import { deleteMessageDb } from "../modules/messages/deleteMessageDb.js";

@Discord()
export class MessageDelete {
  @On()
  async messageDelete([message]: ArgsOf<"messageDelete">, client: Client) {
    await deleteMessageDb(message);
  }
}
