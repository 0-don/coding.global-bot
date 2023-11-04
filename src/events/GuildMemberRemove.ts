import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";
import { updateMemberCount } from "../modules/members/updateMemberCount.js";
import { upsertDbMember } from "../modules/members/upsertDbMember.js";

@Discord()
export class GuildMemberRemove {
  @On()
  async guildMemberRemove(
    [member]: ArgsOf<"guildMemberRemove">,
    client: Client,
  ) {
    // create or update user with his roles
    await upsertDbMember(member, "leave");

    // update user count channel
    await updateMemberCount(member);

    //  await logJoinLeaveEvents(member, 'leave')
  }
}
