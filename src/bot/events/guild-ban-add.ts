import {
  AuditLogEvent,
  findAuditActor,
} from "@/core/services/moderation/audit-log";
import { ModLogService } from "@/core/services/moderation/modlog.service";
import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";

@Discord()
export class GuildBanAdd {
  @On({ event: "guildBanAdd" })
  async guildBanAdd([ban]: ArgsOf<"guildBanAdd">, client: Client) {
    // The ban event carries no moderator, and its own `reason` is only
    // populated when the ban is fetched - the audit log has both.
    const actor = await findAuditActor(
      ban.guild,
      AuditLogEvent.MemberBanAdd,
      ban.user.id,
    );

    await ModLogService.postLog({
      guild: ban.guild,
      action: "ban",
      targetId: ban.user.id,
      targetName: ban.user.username,
      targetUser: ban.user,
      moderatorId: actor?.moderatorId,
      moderatorName: actor?.moderatorName,
      reason: actor?.reason ?? ban.reason ?? undefined,
    });
  }
}
