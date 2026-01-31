import "@dotenvx/dotenvx/config";

import { cacheMiddleware } from "@/api/middleware/cache";
import { newsRoutes } from "@/api/routes/news.routes";
import { staffRoutes } from "@/api/routes/staff.routes";
import { statsRoutes } from "@/api/routes/stats.routes";
import { threadRoutes } from "@/api/routes/thread.routes";
import { userRoutes } from "@/api/routes/user.routes";
import { widgetRoutes } from "@/api/routes/widget.routes";
import { apiLogger } from "@/lib/telemetry";
import { cors } from "@elysiajs/cors";
import { node } from "@elysiajs/node";
import { fromTypes, openapi } from "@elysiajs/openapi";
import { opentelemetry } from "@elysiajs/opentelemetry";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-node";
import { Elysia } from "elysia";

export const app = new Elysia({ adapter: node() })
  .use(
    process.env.POSTHOG_KEY
      ? opentelemetry({
          serviceName: "coding-global-bot-api",
          spanProcessors: [
            new BatchSpanProcessor(
              new OTLPTraceExporter({
                url: "https://eu.i.posthog.com/i/v1/traces",
                headers: {
                  Authorization: `Bearer ${process.env.POSTHOG_KEY}`,
                },
              }),
            ),
          ],
        })
      : (app: Elysia) => app,
  )
  .use(
    openapi({
      documentation: {
        openapi: "3.1.0",
      },
      references: fromTypes(
        process.env.NODE_ENV === "production"
          ? "dist/elysia.d.ts"
          : "src/elysia.ts",
      ),
    }),
  )
  .use(cors())
  .use(cacheMiddleware)
  .onError(({ error }) => {
    if (error instanceof Error) {
      console.error("Error:", error.message);
    }
  })
  .use(staffRoutes)
  .use(newsRoutes)
  .use(widgetRoutes)
  .use(threadRoutes)
  .use(statsRoutes)
  .use(userRoutes)
  .listen(4000, () => {
    apiLogger.info("Elysia server started", { port: 4000 });
  });
