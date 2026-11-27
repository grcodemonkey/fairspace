import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// Vercel already sets env vars; locally they come from .env.local.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// Neon: DDL and drizzle's migration lock need the direct endpoint, not PgBouncer. The Vercel Neon integration sets both.
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
});
