import { db } from "@/lib/db";
import { modLog } from "@/lib/db-schema";
import { BOT_ICON, RED_COLOR } from "@/shared/config/branding";
import { MOD_LOG_CHANNELS } from "@/shared/config/channels";
import { JAIL } from "@/shared/config/roles";
import {
  AuditLogEvent,
  ChannelType,
  type Guild,
  type GuildAuditLogsEntry,
  type GuildMember,
} from "discord.js";
import { and, desc, eq } from "drizzle-orm";
import { error } from "node:console";

export type ModAction =
  | "User Warned"
  | "User Jailed"
  | "User Unjailed"
  | "User Kicked"
  | "User Banned"
  | "User Unbanned"
  | "User Timed Out"
  | "User Untimed Out"
  | "Messages Deleted";

interface ModLogEntry {
  action: ModAction;
  targetId: string;
  moderatorId: string | null;
  reason?: string | null;
}

// Lifting a punishment needs no justification, so these carry no reason.
const LIFTS: ModAction[] = ["User Unjailed", "User Untimed Out"];

const changesJail = (entry: GuildAuditLogsEntry, key: "$add" | "$remove") =>
  entry.changes.some(
    (change) =>
      change.key === key &&
      Array.isArray(change.new) &&
      change.new.some((role) => role.name === JAIL),
  );

export class ModLogService {
  static actionFromAudit(entry: GuildAuditLogsEntry): ModAction | null {
    switch (entry.action) {
      case AuditLogEvent.MemberKick:
        return "User Kicked";
      case AuditLogEvent.MemberBanAdd:
        return "User Banned";
      case AuditLogEvent.MemberBanRemove:
        return "User Unbanned";
      case AuditLogEvent.MemberUpdate: {
        const change = entry.changes.find(
          (c) => c.key === "communication_disabled_until",
        );
        if (!change) return null;
        return change.new ? "User Timed Out" : "User Untimed Out";
      }
      case AuditLogEvent.MemberRoleUpdate:
        if (changesJail(entry, "$add")) return "User Jailed";
        if (changesJail(entry, "$remove")) return "User Unjailed";
        return null;
      default:
        return null;
    }
  }

  static async record(guild: Guild, entry: ModLogEntry) {
    const lift = LIFTS.includes(entry.action);
    const reason = lift ? null : entry.reason?.trim() || null;

    await db
      .insert(modLog)
      .values({
        guildId: guild.id,
        action: entry.action,
        targetId: entry.targetId,
        moderatorId: entry.moderatorId,
        reason,
      })
      .catch(error);

    const description = [
      `**Member:** <@${entry.targetId}> (${entry.targetId})`,
      `**By:** ${entry.moderatorId ? `<@${entry.moderatorId}>` : "unknown"}`,
    ];
    if (!lift)
      description.push(
        `**Reason:** ${reason?.slice(0, 1000) ?? "No reason provided"}`,
      );

    for (const channel of guild.channels.cache.values()) {
      if (
        channel.type !== ChannelType.GuildText ||
        !MOD_LOG_CHANNELS.includes(channel.name)
      )
        continue;
      await channel
        .send({
          embeds: [
            {
              color: RED_COLOR,
              title: entry.action,
              description: description.join("\n"),
              timestamp: new Date().toISOString(),
              footer: { text: "Mod Log", icon_url: BOT_ICON },
            },
          ],
          allowedMentions: { users: [], roles: [] },
        })
        .catch(error);
    }
  }

  // Staff often unjail by giving a status role (Verified); the bot then strips
  // Jail itself, so that removal's audit entry names the bot. Credit whoever
  // added the status role instead.
  static async recordStatusRoleUnjail(
    target: Pick<GuildMember, "id" | "guild">,
    addedRole: string,
  ) {
    const findAdder = async () => {
      const logs = await target.guild
        .fetchAuditLogs({ type: AuditLogEvent.MemberRoleUpdate, limit: 10 })
        .catch(() => null);
      return logs?.entries.find(
        (entry) =>
          entry.targetId === target.id &&
          entry.changes.some(
            (change) =>
              change.key === "$add" &&
              Array.isArray(change.new) &&
              change.new.some((role) => role.name === addedRole),
          ),
      );
    };

    // The audit entry can land a moment after the member update event.
    let entry = await findAdder();
    if (!entry) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      entry = await findAdder();
    }

    await this.record(target.guild, {
      action: "User Unjailed",
      targetId: target.id,
      moderatorId: entry?.executorId ?? null,
    });
  }

  static recent(guildId: string, targetId?: string) {
    return db
      .select()
      .from(modLog)
      .where(
        targetId
          ? and(eq(modLog.guildId, guildId), eq(modLog.targetId, targetId))
          : eq(modLog.guildId, guildId),
      )
      .orderBy(desc(modLog.createdAt))
      .limit(20);
  }
}
