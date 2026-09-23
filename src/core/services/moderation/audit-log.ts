import { botLogger } from "@/lib/telemetry";
import { AuditLogEvent, PermissionFlagsBits, type Guild } from "discord.js";

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

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function lookup(
  guild: Guild,
  type: AuditLogEvent,
  targetId: string,
): Promise<AuditActor | null> {
  const logs = await guild.fetchAuditLogs({ type, limit: 5 });

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
      Date.now() - e.createdTimestamp < MAX_ENTRY_AGE_MS,
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
 * Returns null when nothing matches, which is the normal answer for a member
 * who simply left.
 */
export async function findAuditActor(
  guild: Guild,
  type: AuditLogEvent,
  targetId: string,
): Promise<AuditActor | null> {
  if (!guild.members.me?.permissions.has(PermissionFlagsBits.ViewAuditLog)) {
    botLogger.warn(
      "Cannot read the audit log: missing View Audit Log. Kicks, bans and timeouts will be logged without a moderator or reason",
      { guildId: guild.id },
    );
    return null;
  }

  try {
    const first = await lookup(guild, type, targetId);
    if (first) return first;

    await wait(RETRY_DELAY_MS);
    return await lookup(guild, type, targetId);
  } catch (e) {
    botLogger.error("Audit log lookup failed", {
      guildId: guild.id,
      targetId,
      error: String(e),
    });
    return null;
  }
}

export { AuditLogEvent };
