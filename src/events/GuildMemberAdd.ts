import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";
import { MembersService } from "../lib/members/Members.service.js";
import { joinSettings } from "../lib/members/joinNickname.js";

@Discord()
export class GuildMemberAdd {
  @On({ event: "guildMemberAdd" })
  async guildMemberAdd([member]: ArgsOf<"guildMemberAdd">, client: Client) {
    MembersService.logJoinLeaveEvents(member, "join");

    // create or update user with his roles
    await MembersService.upsertDbMember(member, "join");

    // rules not yet accepted
    if (member.pending) return;

    // update user count channel
    await MembersService.updateMemberCount(member);

    await joinSettings(member);
  }
}
