import "@dotenvx/dotenvx/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./db-schema";

// Strip Prisma-specific ?schema= parameter that postgres.js doesn't support
const databaseUrl = process.env.DATABASE_URL!.replace(/[?&]schema=[^&]+/, "");

export const db = drizzle(
  postgres(databaseUrl, { onnotice: () => {} }),
  { schema },
);
