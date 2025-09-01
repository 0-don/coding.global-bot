import { log } from "console";
import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";

@Discord()
export class ClientReady {
  @On()
  async clientReady([_]: ArgsOf<"clientReady">, client: Client) {
    log(`Ready! Logged in as ${client.user?.tag}`);
  }
}
