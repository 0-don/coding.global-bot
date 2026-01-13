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

export const extractExpiresAt = (url: string): Date | null => {
  try {
    const params = new URL(url).searchParams;
    const ex = params.get("ex");
    if (!ex) return null;
    return new Date(parseInt(ex, 16) * 1000);
  } catch {
    return null;
  }
};
