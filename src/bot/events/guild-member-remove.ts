import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";
import { MembersService } from "@/core/services/members/members.service";
import {
  AuditLogEvent,
  findAuditActor,
} from "@/core/services/moderation/audit-log";
import { ModLogService } from "@/core/services/moderation/modlog.service";

@Discord()
export class GuildMemberRemove {
  @On()
  async guildMemberRemove(
    [member]: ArgsOf<"guildMemberRemove">,
    client: Client,
  ) {
    // create or update user with his roles
    await MembersService.upsertDbMember(member, "leave");

    // update user count channel
    await MembersService.updateMemberCount(member);

    //  await logJoinLeaveEvents(member, 'leave')

    // Discord fires this identically for a leave, a kick and a ban; only the
    // audit log tells them apart. Bans are logged by guildBanAdd, so only
    // kicks are looked for here.
    const kicked = await findAuditActor(
      member.guild,
      AuditLogEvent.MemberKick,
      member.id,
    );

    if (kicked) {
      await ModLogService.postLog({
        guild: member.guild,
        action: "kick",
        targetId: member.id,
        targetName: member.user.username,
        targetUser: member.user,
        moderatorId: kicked.moderatorId,
        moderatorName: kicked.moderatorName,
        reason: kicked.reason,
      });
    }
  }
}
