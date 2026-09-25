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
} from "discord.js";
import { and, desc, eq } from "drizzle-orm";
import { error } from "node:console";

export type ModAction =
  | "User Warned"
  | "User Unjailed"
  | "User Kicked"
  | "User Banned"
  | "User Unbanned"
  | "User Timed Out"
  | "User Untimed Out";

interface ModLogEntry {
  action: ModAction;
  targetId: string;
  moderatorId: string | null;
  reason: string | null;
}

const removesJail = (entry: GuildAuditLogsEntry) =>
  entry.changes.some(
    (change) =>
      change.key === "$remove" &&
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
        if (removesJail(entry)) return "User Unjailed";
        return null;
      default:
        return null;
    }
  }

  static async record(guild: Guild, entry: ModLogEntry) {
    await db
      .insert(modLog)
      .values({ guildId: guild.id, ...entry })
      .catch(error);

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
              description: [
                `**Member:** <@${entry.targetId}> (${entry.targetId})`,
                `**By:** ${entry.moderatorId ? `<@${entry.moderatorId}>` : "unknown"}`,
                `**Reason:** ${entry.reason || "No reason provided"}`,
              ].join("\n"),
              timestamp: new Date().toISOString(),
              footer: { text: "Mod Log", icon_url: BOT_ICON },
            },
          ],
          allowedMentions: { users: [], roles: [] },
        })
        .catch(error);
    }
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
