export type ModeratorTier = "staff" | "helper";

// Discord refuses a timeout longer than 28 days.
export const MAX_TIMEOUT_MINUTES = 28 * 24 * 60;

export const MUTE_LIMIT_MINUTES: Record<ModeratorTier, number> = {
  staff: MAX_TIMEOUT_MINUTES,
  helper: 60,
};

const DURATION_PATTERN = /^(\d+)\s*(m|min|mins|h|hr|hrs|d|day|days)$/i;

const UNIT_MINUTES: Record<string, number> = {
  m: 1,
  min: 1,
  mins: 1,
  h: 60,
  hr: 60,
  hrs: 60,
  d: 1440,
  day: 1440,
  days: 1440,
};

export function parseDurationMinutes(input: string): number | null {
  const match = DURATION_PATTERN.exec(input.trim());
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = UNIT_MINUTES[match[2]!.toLowerCase()];
  if (!amount || !unit) return null;

  const minutes = amount * unit;
  return minutes > MAX_TIMEOUT_MINUTES ? null : minutes;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) {
    const hours = minutes / 60;
    return Number.isInteger(hours) ? `${hours}h` : `${(minutes / 60).toFixed(1)}h`;
  }
  const days = minutes / 1440;
  return Number.isInteger(days) ? `${days}d` : `${days.toFixed(1)}d`;
}
