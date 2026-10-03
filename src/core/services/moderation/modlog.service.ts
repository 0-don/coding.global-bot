import { db } from "@/lib/db";
import { modLog } from "@/lib/db-schema";
import { logEmbed, type LogTone } from "@/core/embeds/log.embed";
import { MOD_LOG_CHANNELS } from "@/shared/config/channels";
import { JAIL, STATUS_ROLES } from "@/shared/config/roles";
import {
  AuditLogEvent,
  ChannelType,
  type Guild,
  type GuildAuditLogsEntry,
} from "discord.js";
import { and, desc, eq, inArray } from "drizzle-orm";
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
  note?: string;
}

// Colour by severity, so a ban and an unban read differently at a glance.
const ACTION_TONES: Record<ModAction, LogTone> = {
  "User Warned": "caution",
  "User Jailed": "negative",
  "User Unjailed": "positive",
  "User Kicked": "negative",
  "User Banned": "negative",
  "User Unbanned": "positive",
  "User Timed Out": "caution",
  "User Untimed Out": "positive",
  "Messages Deleted": "negative",
};

const normalize = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

const MOD_LOG_NAMES = MOD_LOG_CHANNELS.map(normalize).filter(Boolean);

const isModLogChannel = (name: string) =>
  MOD_LOG_NAMES.some((wanted) => normalize(name).includes(wanted));

const changesRole = (
  entry: GuildAuditLogsEntry,
  key: "$add" | "$remove",
  matches: (name: string) => boolean,
) =>
  entry.changes.some(
    (change) =>
      change.key === key &&
      Array.isArray(change.new) &&
      change.new.some((role) => matches(role.name)),
  );

const isJail = (name: string) => name === JAIL;
const isOtherStatusRole = (name: string) =>
  !isJail(name) && STATUS_ROLES.includes(name);

export class ModLogService {
  static async actionFromAudit(
    guild: Guild,
    entry: GuildAuditLogsEntry,
  ): Promise<ModAction | null> {
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
        if (!JAIL || !entry.targetId) return null;
        if (changesRole(entry, "$add", isJail)) return "User Jailed";
        if (changesRole(entry, "$remove", isJail)) return "User Unjailed";
        // Staff often unjail by giving a status role (Verified); the bot then
        // strips Jail itself, so that removal's audit entry names the bot. The
        // entry for the status role names who did it.
        return changesRole(entry, "$add", isOtherStatusRole) &&
          (await this.isJailed(guild, entry.targetId))
          ? "User Unjailed"
          : null;
      default:
        return null;
    }
  }

  static async record(guild: Guild, entry: ModLogEntry) {
    const reason = entry.reason?.trim() || null;

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

    const user = await guild.client.users
      .fetch(entry.targetId)
      .catch(() => null);

    const embed = logEmbed({
      tone: ACTION_TONES[entry.action],
      title: entry.action,
      user,
      lines: [
        `<@${entry.targetId}> (${user?.username ?? "unknown"})`,
        `**By:** ${entry.moderatorId ? `<@${entry.moderatorId}>` : "unknown"}`,
        reason && `**Reason:** ${reason.slice(0, 1000)}`,
        entry.note ? `**Note:** ${entry.note}` : null,
        `-# ${entry.targetId}`,
      ],
      footer: "Mod Log",
    });

    for (const channel of guild.channels.cache.values()) {
      if (
        channel.type !== ChannelType.GuildText ||
        !isModLogChannel(channel.name)
      )
        continue;
      await channel
        .send({ embeds: [embed], allowedMentions: { users: [], roles: [] } })
        .catch(error);
    }
  }

  // The bot may have stripped Jail before the audit entry arrives, so when the
  // role is gone the newest jail or unjail entry decides.
  static async isJailed(guild: Guild, targetId: string): Promise<boolean> {
    const member = guild.members.cache.get(targetId);
    if (member?.roles.cache.some((role) => isJail(role.name))) return true;

    const [latest] = await db
      .select({ action: modLog.action })
      .from(modLog)
      .where(
        and(
          eq(modLog.guildId, guild.id),
          eq(modLog.targetId, targetId),
          inArray(modLog.action, ["User Jailed", "User Unjailed"]),
        ),
      )
      .orderBy(desc(modLog.createdAt), desc(modLog.id))
      .limit(1);
    return latest?.action === "User Jailed";
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
