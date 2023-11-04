import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";
import { updateNickname } from "../lib/members/saveNickname.js";
import { updateDbRoles } from "../lib/roles/updateDbRoles.js";
import { updateStatusRoles } from "../lib/roles/updateStatusRoles.js";

@Discord()
export class GuildMemberUpdate {
  @On()
  async guildMemberUpdate([oldMember, newMember]: ArgsOf<"guildMemberUpdate">, client: Client) {
    // update db roles
    await updateDbRoles(oldMember, newMember);

    // update status roles
    await updateStatusRoles(oldMember, newMember);

    await updateNickname(oldMember, newMember);
  }
}
