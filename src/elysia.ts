import { cache } from "@/api/middleware/cache";
import { boardRoutes } from "@/api/routes/board.routes";
import { newsRoutes } from "@/api/routes/news.routes";
import { staffRoutes } from "@/api/routes/staff.routes";
import { statsRoutes } from "@/api/routes/stats.routes";
import { userRoutes } from "@/api/routes/user.routes";
import { widgetRoutes } from "@/api/routes/widget.routes";
import { Prisma } from "@/generated/prisma/client";
import { cors } from "@elysiajs/cors";
import { node } from "@elysiajs/node";
import { fromTypes, openapi } from "@elysiajs/openapi";
import { log } from "console";
import { Elysia } from "elysia";

export const app = new Elysia({ adapter: node() })
  .use(
    openapi({
      references: fromTypes(
        process.env.NODE_ENV === "production"
          ? "dist/elysia.d.ts"
          : "src/elysia.ts",
      ),
    }),
  )
  .use(cors())
  .onError(({ error }) => {
    // Log Prisma-specific errors only
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("Prisma Error:", error.code, error.message, error.meta);
    } else if (error instanceof Prisma.PrismaClientValidationError) {
      console.error("Prisma Validation Error:", error.message);
    }
  })
  .derive(({ request, path }) => {
    if (request.method !== "GET") return { cacheKey: null };
    const url = new URL(request.url);
    const cacheKey = url.search ? `${path}${url.search}` : path;
    return { cacheKey };
  })
  .onBeforeHandle(({ cacheKey }) => {
    if (!cacheKey) return;
    return cache.get(cacheKey);
  })
  .onAfterHandle(({ cacheKey, responseValue }) => {
    if (cacheKey) cache.set(cacheKey, responseValue as object);
  })
  // Routes
  .use(staffRoutes)
  .use(newsRoutes)
  .use(widgetRoutes)
  .use(boardRoutes)
  .use(statsRoutes)
  .use(userRoutes)
  .listen(4000);

log("Server started on port 4000");
