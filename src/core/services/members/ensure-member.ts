import { db } from "@/lib/db";
import { member } from "@/lib/db-schema";

/**
 * Insert placeholder Member rows for IDs that may not be synced yet.
 *
 * Moderation writes (warnings, mod log) carry foreign keys to Member for both
 * the target and the moderator. Acting on someone the bot has never recorded -
 * a member who joined while the bot was down, or a moderator who has never
 * spoken - would violate those constraints and silently lose the record.
 *
 * Existing rows are left untouched, so a real username is never overwritten
 * with a placeholder; the regular member sync fills in the details later.
 */
export async function ensureMemberRows(
  members: ({ memberId?: string; username?: string } | undefined)[],
) {
  const seen = new Set<string>();
  const rows: { memberId: string; username: string }[] = [];

  for (const entry of members) {
    const memberId = entry?.memberId;
    if (!memberId || seen.has(memberId)) continue;
    seen.add(memberId);
    rows.push({ memberId, username: entry?.username || "Unknown User" });
  }

  if (!rows.length) return;

  await db.insert(member).values(rows).onConflictDoNothing();
}
