import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// Vercel already sets env vars; locally they come from .env.local.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL },
});
