import { error } from "console";
import type { GuildMember } from "discord.js";
import { queueMemberUpdate } from "@/core/services/members/member-update-queue.service";
import { MembersService } from "@/core/services/members/members.service";

export async function handleGuildMemberAdd(member: GuildMember): Promise<void> {
  try {
    MembersService.logJoinLeaveEvents(member, "join");

    queueMemberUpdate(member.id, member.guild.id);
    MembersService.upsertDbMember(member, "join");

    if (member.pending) return;

    MembersService.updateMemberCount(member);

    MembersService.joinSettings(member);
  } catch (err) {
    error(`Failed to process guild member add for ${member.id}:`, err);
  }
}
