import { error } from "console";
import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";
import { joinSettings } from "../lib/members/join-nickname";
import { queueMemberUpdate } from "../lib/members/member-update-queue.service";
import { MembersService } from "../lib/members/members.service";

@Discord()
export class GuildMemberAdd {
  @On({ event: "guildMemberAdd" })
  async guildMemberAdd([member]: ArgsOf<"guildMemberAdd">, client: Client) {
    try {
      MembersService.logJoinLeaveEvents(member, "join");

      queueMemberUpdate(member.id, member.guild.id);
      // create or update user with his roles
      MembersService.upsertDbMember(member, "join");

      if (member.pending) return;

      MembersService.updateMemberCount(member);

      joinSettings(member);
    } catch (err) {
      error(`Failed to process guild member add for ${member.id}:`, err);
    }
  }
}
