import { cacheMiddleware } from "@/api/middleware/cache";
import { threadRoutes } from "@/api/routes/thread.routes";
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
  .use(cacheMiddleware)
  .onError(({ error }) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("Prisma Error:", error.code, error.message, error.meta);
    } else if (error instanceof Prisma.PrismaClientValidationError) {
      console.error("Prisma Validation Error:", error.message);
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
