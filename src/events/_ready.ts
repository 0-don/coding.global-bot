import { log } from "console";
import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";

@Discord()
export class Ready {
  @On()
  async ready([_]: ArgsOf<"ready">, client: Client) {
    log(`Ready! Logged in as ${client.user?.tag}`);
  }
}
