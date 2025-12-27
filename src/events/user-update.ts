import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";
import { queueMemberUpdate } from "../lib/members/member-update-queue.service";

@Discord()
export class UserUpdate {
  @On()
  async userUpdate([, newUser]: ArgsOf<"userUpdate">, client: Client) {
    for (const guild of client.guilds.cache.values()) {
      if (guild.members.cache.has(newUser.id)) {
        queueMemberUpdate(newUser.id, guild.id);
      }
    }
  }
}
