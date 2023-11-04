import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";
import { MembersModule } from "../modules/members/Members.module.js";

@Discord()
export class GuildMemberRemove {
  @On()
  async guildMemberRemove(
    [member]: ArgsOf<"guildMemberRemove">,
    client: Client,
  ) {
    // create or update user with his roles
    await MembersModule.upsertDbMember(member, "leave");

    // update user count channel
    await MembersModule.updateMemberCount(member);

    //  await logJoinLeaveEvents(member, 'leave')
  }
}
