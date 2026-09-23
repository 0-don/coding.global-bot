/**
 * Moderation changes the bot is about to make itself.
 *
 * /timeout and /untimeout log with the moderator's name, and the resulting
 * guildMemberUpdate would otherwise log the same change a second time. The
 * audit log can say the bot did it, but only with View Audit Log and only once
 * the entry has landed, so the command notes the change here before making it
 * and the event handler consumes the note.
 */
type BotAction = "timeout" | "untimeout";

// Long enough for the gateway event to arrive, short enough that a note left
// by a failed call cannot swallow a later genuine change.
const EXPECTATION_MS = 15_000;

const expected = new Map<string, number>();

const key = (guildId: string, memberId: string, action: BotAction) =>
  `${guildId}:${memberId}:${action}`;

export function expectBotAction(
  guildId: string,
  memberId: string,
  action: BotAction,
): void {
  const now = Date.now();
  for (const [k, expiresAt] of expected) if (expiresAt <= now) expected.delete(k);

  expected.set(key(guildId, memberId, action), now + EXPECTATION_MS);
}

export function cancelBotAction(
  guildId: string,
  memberId: string,
  action: BotAction,
): void {
  expected.delete(key(guildId, memberId, action));
}

/** True, once, if the bot said it was about to make this change. */
export function consumeBotAction(
  guildId: string,
  memberId: string,
  action: BotAction,
): boolean {
  const k = key(guildId, memberId, action);
  const expiresAt = expected.get(k);
  expected.delete(k);
  return expiresAt !== undefined && expiresAt > Date.now();
}
