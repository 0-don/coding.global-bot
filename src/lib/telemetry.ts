import { logs, SeverityNumber } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  BatchLogRecordProcessor,
  LoggerProvider,
} from "@opentelemetry/sdk-logs";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

let loggerProvider: LoggerProvider | null = null;

// Dev mode: NODE_ENV is not set or is "development"
const isDev =
  !process.env.NODE_ENV || process.env.NODE_ENV === "development";

export function initTelemetry(serviceName: string) {
  if (loggerProvider) return;
  if (isDev) {
    console.info("Dev mode, PostHog telemetry disabled");
    return;
  }
  if (!process.env.POSTHOG_KEY) {
    console.warn("POSTHOG_KEY not set, telemetry disabled");
    return;
  }

  console.info(`PostHog telemetry enabled for ${serviceName}`);

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
  });

  const logExporter = new OTLPLogExporter({
    url: "https://eu.i.posthog.com/i/v1/logs",
    headers: {
      Authorization: `Bearer ${process.env.POSTHOG_KEY}`,
    },
  });

  loggerProvider = new LoggerProvider({
    resource,
    processors: [new BatchLogRecordProcessor(logExporter)],
  });
  logs.setGlobalLoggerProvider(loggerProvider);
}

export async function shutdownTelemetry() {
  if (loggerProvider) await loggerProvider.shutdown();
}

const severityMap = {
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
} as const;

export function getLogger(name: string) {
  const logger = logs.getLogger(name);

  const emit = (
    level: keyof typeof severityMap,
    message: string,
    attrs?: Record<string, unknown>,
  ) => {
    // Only send to PostHog in production
    if (!isDev && loggerProvider) {
      logger.emit({
        severityNumber: severityMap[level],
        severityText: level.toUpperCase(),
        body: message,
        attributes: attrs as Record<string, string | number | boolean>,
      });
    }
    // Always log to console
    console[level](`[${name}] ${message}`, attrs || "");
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

// Pre-configured loggers for common use
export const botLogger = getLogger("coding-global-bot");
export const apiLogger = getLogger("coding-global-bot-api");
