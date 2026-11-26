import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

// Reuse one client across dev hot reloads so each reload does not open a new pool.
const globalForDb = globalThis as unknown as { db?: Db };

// Lazy so `next build` and plain imports work with no DATABASE_URL; only a real query needs it.
export function getDb(): Db {
  if (globalForDb.db) return globalForDb.db;
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  const db = drizzle({ client: postgres(process.env.DATABASE_URL), schema });
  globalForDb.db = db;
  return db;
}
