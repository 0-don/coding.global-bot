import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";
import { joinSettings } from "../lib/members/join-nickname";
import { MembersService } from "../lib/members/members.service";

@Discord()
export class GuildMemberAdd {
  @On({ event: "guildMemberAdd" })
  async guildMemberAdd([member]: ArgsOf<"guildMemberAdd">, client: Client) {
    MembersService.logJoinLeaveEvents(member, "join");

    // create or update user with his roles
    MembersService.upsertDbMember(member, "join");

    // rules not yet accepted
    if (member.pending) return;

    // update user count channel
    MembersService.updateMemberCount(member);

    joinSettings(member);
  }
}
