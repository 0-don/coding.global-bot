import "@dotenvx/dotenvx/config";
import { logs, SeverityNumber } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { NodeSDK } from "@opentelemetry/sdk-node";

const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === "development";
let sdk: NodeSDK | null = null;

if (!isDev && process.env.POSTHOG_KEY) {
  sdk = new NodeSDK({
    resource: resourceFromAttributes({ "service.name": "coding-global-bot" }),
    // @ts-ignore
    logRecordProcessor: new BatchLogRecordProcessor(
      new OTLPLogExporter({
        url: "https://eu.i.posthog.com/i/v1/logs",
        headers: { Authorization: `Bearer ${process.env.POSTHOG_KEY}` },
      }),
    ),
  });
  sdk.start();
}

export const shutdownTelemetry = () => sdk?.shutdown();

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
    msg: string,
    attrs?: Record<string, unknown>,
  ) => {
    if (!isDev && sdk) {
      logger.emit({
        severityNumber: severityMap[level],
        severityText: level.toUpperCase(),
        body: msg,
        attributes: attrs as Record<string, string | number | boolean>,
      });
    }
    console[level](`[${name}] ${msg}`, attrs || "");
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
