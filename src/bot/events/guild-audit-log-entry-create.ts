import { ModLogService } from "@/core/services/moderation/modlog.service";
import type { ArgsOf } from "discordx";
import { Discord, On } from "discordx";

@Discord()
export class GuildAuditLogEntryCreate {
  @On()
  async guildAuditLogEntryCreate([
    entry,
    guild,
  ]: ArgsOf<"guildAuditLogEntryCreate">): Promise<void> {
    // The bot's own actions are recorded where they happen, with the staff member
    // who ran the command; here they would all read "by the bot".
    if (entry.executorId === guild.client.user.id) return;

    const action = ModLogService.actionFromAudit(entry);
    if (!action || !entry.targetId) return;

    await ModLogService.record(guild, {
      action,
      targetId: entry.targetId,
      moderatorId: entry.executorId,
      reason: entry.reason,
    });
  }
}
