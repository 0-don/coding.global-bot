import { ModLogService } from "@/core/services/moderation/modlog.service";
import { MuteService } from "@/core/services/moderation/mute.service";
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

    const action = await ModLogService.actionFromAudit(guild, entry);
    if (!action || !entry.targetId) return;

    // A timeout changed in Discord's member menu skips /timeout's rank check, so
    // it is recorded for the next change and flagged when it overrode a higher rank.
    let note: string | undefined;
    if (
      entry.executorId &&
      (action === "User Timed Out" || action === "User Untimed Out")
    ) {
      const target = await guild.members.fetch(entry.targetId).catch(() => null);
      const change = entry.changes.find(
        (c) => c.key === "communication_disabled_until",
      );
      if (target) {
        const outranked = await MuteService.recordMenuChange({
          target,
          actorId: entry.executorId,
          expiresAt:
            typeof change?.new === "string" ? Date.parse(change.new) : null,
          reason: entry.reason ?? undefined,
        });
        if (outranked)
          note = `Overrode a timeout set by <@${outranked.id}>, who outranks them.`;
      }
    }

    await ModLogService.record(guild, {
      action,
      targetId: entry.targetId,
      moderatorId: entry.executorId,
      reason: entry.reason,
      note,
    });
  }
}
