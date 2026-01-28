import "@dotenvx/dotenvx/config";
import { error } from "console";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { resolve } from "path";
import postgres from "postgres";
import * as schema from "./db-schema";

const databaseUrl = process.env.DATABASE_URL!;

export const db = drizzle(postgres(databaseUrl, { onnotice: () => {} }), {
  schema,
});

// Skip migration during build time (STANDALONE is set in Dockerfile during build)
if (!process.env.STANDALONE) {
  migrate(db, { migrationsFolder: resolve("drizzle") }).catch((e) =>
    error("Database migration failed", e),
  );
}
