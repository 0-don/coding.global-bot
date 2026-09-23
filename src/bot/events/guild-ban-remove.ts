import {
  AuditLogEvent,
  findAuditActor,
} from "@/core/services/moderation/audit-log";
import { ModLogService } from "@/core/services/moderation/modlog.service";
import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";

@Discord()
export class GuildBanRemove {
  @On({ event: "guildBanRemove" })
  async guildBanRemove([ban]: ArgsOf<"guildBanRemove">, client: Client) {
    const actor = await findAuditActor(
      ban.guild,
      AuditLogEvent.MemberBanRemove,
      ban.user.id,
    );

    await ModLogService.postLog({
      guild: ban.guild,
      action: "unban",
      targetId: ban.user.id,
      targetName: ban.user.username,
      targetUser: ban.user,
      moderatorId: actor?.moderatorId,
      moderatorName: actor?.moderatorName,
      reason: actor?.reason,
    });
  }
}
