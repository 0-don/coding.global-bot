import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";
import { MembersService } from "../lib/members/Members.service.js";

@Discord()
export class GuildMemberRemove {
  @On()
  async guildMemberRemove([member]: ArgsOf<"guildMemberRemove">, client: Client) {
    // create or update user with his roles
    await MembersService.upsertDbMember(member, "leave");

    // update user count channel
    await MembersService.updateMemberCount(member);

    //  await logJoinLeaveEvents(member, 'leave')
  }
}
