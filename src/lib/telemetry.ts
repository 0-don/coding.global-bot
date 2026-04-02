import "@dotenvx/dotenvx/config";
import { PostHog } from "posthog-node";

const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === "development";

const posthog =
  !isDev && process.env.POSTHOG_KEY
    ? new PostHog(process.env.POSTHOG_KEY, {
        host: "https://eu.i.posthog.com",
        flushAt: 10,
        flushInterval: 5000,
      })
    : null;

export const shutdownTelemetry = () => posthog?.shutdown();

export function getLogger(name: string) {
  const emit = (
    level: "debug" | "info" | "warn" | "error",
    msg: string,
    attrs?: Record<string, unknown>,
  ) => {
    if (posthog) {
      posthog.capture({
        distinctId: name,
        event: "bot_log",
        properties: {
          severity: level.toUpperCase(),
          message: msg,
          service: name,
          ...attrs,
        },
      });
    }
    const prefix =
      level === "error"
        ? "ERR"
        : level === "warn"
          ? "WRN"
          : level === "debug"
            ? "DBG"
            : "INF";
    const stream =
      level === "error" || level === "warn" ? process.stderr : process.stdout;
    stream.write(`${prefix} ${JSON.stringify({ name, msg, ...attrs })}\n`);
  };
  return {
    debug: (msg: string, attrs?: Record<string, unknown>) =>
      emit("debug", msg, attrs),
    info: (msg: string, attrs?: Record<string, unknown>) =>
      emit("info", msg, attrs),
    warn: (msg: string, attrs?: Record<string, unknown>) =>
      emit("warn", msg, attrs),
    error: (msg: string, attrs?: Record<string, unknown>) =>
      emit("error", msg, attrs),
  };
}

export const botLogger = getLogger("coding-global-bot");
export const apiLogger = getLogger("coding-global-bot-api");
