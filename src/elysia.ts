import "@dotenvx/dotenvx/config";

import { cacheMiddleware } from "@/api/middleware/cache";
import { newsRoutes } from "@/api/routes/news.routes";
import { staffRoutes } from "@/api/routes/staff.routes";
import { statsRoutes } from "@/api/routes/stats.routes";
import { threadRoutes } from "@/api/routes/thread.routes";
import { userRoutes } from "@/api/routes/user.routes";
import { widgetRoutes } from "@/api/routes/widget.routes";
import { cors } from "@elysiajs/cors";
import { node } from "@elysiajs/node";
import { fromTypes, openapi } from "@elysiajs/openapi";
import { log } from "console";
import { Elysia } from "elysia";

export const app = new Elysia({ adapter: node() })
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
  .listen(4000);

log("Server started on port 4000");
