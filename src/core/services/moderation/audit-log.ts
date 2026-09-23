import { botLogger } from "@/lib/telemetry";
import {
  AuditLogEvent,
  PermissionFlagsBits,
  type Guild,
  type GuildAuditLogsEntry,
} from "discord.js";

/**
 * Entries older than this are treated as unrelated. Discord gives us no link
 * between a gateway event and an audit entry, so recency plus a matching
 * target is the only correlation available - too wide a window and an old ban
 * gets attributed to someone who just left of their own accord.
 */
const MAX_ENTRY_AGE_MS = 10_000;

/**
 * The audit log is eventually consistent: the entry frequently is not there
 * yet when the gateway event arrives. One short retry catches almost all of
 * them without delaying the log noticeably.
 */
const RETRY_DELAY_MS = 1200;

export interface AuditActor {
  moderatorId?: string;
  moderatorName?: string;
  reason?: string;
}

type EntryFilter = (entry: GuildAuditLogsEntry) => boolean;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Guilds already told about the missing permission. Every leave, role change
 * and timeout asks, so warning each time would bury the logs.
 */
const missingPermissionWarned = new Set<string>();

async function lookup(
  guild: Guild,
  type: AuditLogEvent,
  targetId: string,
  filter: EntryFilter | undefined,
): Promise<AuditActor | null> {
  const logs = await guild.fetchAuditLogs({ type, limit: 10 });

  // The target union spans every audit-loggable entity, and a few of them
  // (Invite, for one) carry no id at all, so it has to be probed rather than
  // read directly.
  const entryTargetId = (target: unknown): string | undefined =>
    target && typeof target === "object" && "id" in target
      ? String((target as { id: unknown }).id)
      : undefined;

  const entry = logs.entries.find(
    (e) =>
      entryTargetId(e.target) === targetId &&
      Date.now() - e.createdTimestamp < MAX_ENTRY_AGE_MS &&
      (!filter || filter(e)),
  );

  if (!entry) return null;

  return {
    moderatorId: entry.executor?.id,
    moderatorName: entry.executor?.username ?? undefined,
    reason: entry.reason ?? undefined,
  };
}

/**
 * Find who performed an action on a member, and why.
 *
 * Discord fires the same guildMemberRemove whether somebody left, was kicked
 * or was banned - only the audit log distinguishes them, so without this every
 * departure looks voluntary.
 *
 * `filter` narrows the match when the newest entry for the member may be a
 * different change - see findRoleChangeActor.
 *
 * Returns null when nothing matches, which is the normal answer for a member
 * who simply left.
 */
export async function findAuditActor(
  guild: Guild,
  type: AuditLogEvent,
  targetId: string,
  filter?: EntryFilter,
): Promise<AuditActor | null> {
  if (!guild.members.me?.permissions.has(PermissionFlagsBits.ViewAuditLog)) {
    if (!missingPermissionWarned.has(guild.id)) {
      missingPermissionWarned.add(guild.id);
      botLogger.warn(
        "Cannot read the audit log: missing View Audit Log. Kicks, bans, timeouts and manual jails will be logged without a moderator or reason",
        { guildId: guild.id },
      );
    }
    return null;
  }

  missingPermissionWarned.delete(guild.id);

  try {
    const first = await lookup(guild, type, targetId, filter);
    if (first) return first;

    await wait(RETRY_DELAY_MS);
    return await lookup(guild, type, targetId, filter);
  } catch (e) {
    botLogger.error("Audit log lookup failed", {
      guildId: guild.id,
      targetId,
      error: String(e),
    });
    return null;
  }
}

/**
 * Who added or removed one specific role.
 *
 * A plain lookup takes the newest role update for the member, which is the
 * wrong one whenever the bot reacts to the change: adding the jail role makes
 * the bot strip every other role, and those removals land on top of the
 * moderator's entry.
 */
export function findRoleChangeActor(
  guild: Guild,
  targetId: string,
  roleId: string,
  change: "$add" | "$remove",
): Promise<AuditActor | null> {
  return findAuditActor(
    guild,
    AuditLogEvent.MemberRoleUpdate,
    targetId,
    (entry) =>
      entry.changes.some(
        (c) =>
          c.key === change &&
          Array.isArray(c.new) &&
          c.new.some(
            (role) =>
              !!role &&
              typeof role === "object" &&
              "id" in role &&
              role.id === roleId,
          ),
      ),
  );
}

export { AuditLogEvent };
