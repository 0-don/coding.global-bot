import { error } from "console";
import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";
import { joinSettings } from "../lib/members/join-nickname";
import { updateCompleteMemberData } from "../lib/members/member-data.service";
import { MembersService } from "../lib/members/members.service";

@Discord()
export class GuildMemberAdd {
  @On({ event: "guildMemberAdd" })
  async guildMemberAdd([member]: ArgsOf<"guildMemberAdd">, client: Client) {
    try {
      MembersService.logJoinLeaveEvents(member, "join");

      await updateCompleteMemberData(member);

      if (member.pending) return;

      MembersService.updateMemberCount(member);

      joinSettings(member);
    } catch (err) {
      error(`Failed to process guild member add for ${member.id}:`, err);
    }
  }
}
