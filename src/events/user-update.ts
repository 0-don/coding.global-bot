import { error } from "console";
import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";
import { updateCompleteMemberData } from "../lib/members/member-data.service";

@Discord()
export class UserUpdate {
  @On()
  async userUpdate([oldUser, newUser]: ArgsOf<"userUpdate">, client: Client) {
    try {
      for (const guild of client.guilds.cache.values()) {
        try {
          const member = await guild.members.fetch(newUser);
          if (member) {
            await updateCompleteMemberData(member);
          }
        } catch (err) {
          continue;
        }
      }
    } catch (err) {
      error(`Failed to update user ${newUser.id}:`, err);
    }
  }
}
