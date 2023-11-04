import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";
import { MembersModule } from "../modules/members/Members.module.js";
import { joinSettings } from "../modules/members/joinNickname.js";

@Discord()
export class GuildMemberAdd {
  @On({ event: "guildMemberAdd" })
  async guildMemberAdd([member]: ArgsOf<"guildMemberAdd">, client: Client) {
    MembersModule.logJoinLeaveEvents(member, "join");

    // create or update user with his roles
    await MembersModule.upsertDbMember(member, "join");

    // rules not yet accepted
    if (member.pending) return;

    // update user count channel
    await MembersModule.updateMemberCount(member);

    await joinSettings(member);
  }
}
