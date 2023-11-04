import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";
import { joinSettings } from "../modules/members/joinNickname.js";
import { logJoinLeaveEvents } from "../modules/members/logJoinLeaveEvents.js";
import { updateMemberCount } from "../modules/members/updateMemberCount.js";
import { upsertDbMember } from "../modules/members/upsertDbMember.js";

@Discord()
export class GuildMemberAdd {
  @On()
  async guildMemberAdd([member]: ArgsOf<"guildMemberAdd">, client: Client) {
    await logJoinLeaveEvents(member, "join");

    // create or update user with his roles
    await upsertDbMember(member, "join");

    // rules not yet accepted
    if (member.pending) return;

    // update user count channel
    await updateMemberCount(member);

    await joinSettings(member);
  }
}
