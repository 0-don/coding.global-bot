import { error, log } from "console";
import dayjs from "dayjs";

export const logTs = (
  level: "info" | "error" | "warn",
  guild: string,
  msg: string,
) => {
  const ts = dayjs().format("HH:mm:ss.SSS");
  const fn = level === "error" ? error : log;
  fn(`[${ts}] [${level.toUpperCase()}] [${guild}] ${msg}`);
};

export const getDaysArray = (s: Date, e: Date) => {
  for (
    var a = [], d = new Date(s);
    d <= new Date(e);
    d.setDate(d.getDate() + 1)
  ) {
    a.push(new Date(d));
  }
  return a;
};

export const extractExpiresAt = (url: string): string | null => {
  try {
    const params = new URL(url).searchParams;
    const ex = params.get("ex");
    if (!ex) return null;
    return new Date(parseInt(ex, 16) * 1000).toISOString();
  } catch {
    return null;
  }
};

/**
 * Read a timestamp that came out of the database.
 *
 * Every timestamp column in this schema is `timestamp without time zone` and
 * every one holds UTC - they default to CURRENT_TIMESTAMP against a GMT
 * session. Drizzle declares them mode: "string", so a value arrives as
 * "2026-08-19 14:07:05.98" with nothing marking it as UTC, and `new Date()`
 * reads a string in that shape as *local* time. On a container running
 * anywhere but UTC, every stored instant therefore shifts by that offset.
 *
 * It surfaced as a warning issued moments earlier rendering in Discord as
 * "in 4 hours". Pinning the parse to UTC is what the stored value already
 * meant; the offset was only ever invented by the reader.
 */
export const fromDbTimestamp = (
  value: string | Date | null | undefined,
): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;

  const iso = value.includes("T") ? value : value.replace(" ", "T");
  return new Date(/[Z+]|-\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`);
};
