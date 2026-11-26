import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// Set on process.env (not test.env) so globalSetup in the main process sees it too; workers inherit it.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://fairspace:fairspace@localhost:5433/fairspace_test";
// Test bucket on local SeaweedFS (pnpm db:up, or the CI service). scripts/storage-setup.ts creates it.
Object.assign(process.env, {
  S3_ENDPOINT: "http://localhost:8333",
  S3_REGION: "auto",
  S3_BUCKET: "fairspace-test",
  S3_ACCESS_KEY_ID: "fairspace",
  S3_SECRET_ACCESS_KEY: "fairspace",
  S3_FORCE_PATH_STYLE: "true",
});

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    globalSetup: "./vitest.global-setup.ts",
    include: ["src/**/*.test.{ts,tsx}"], // keep Playwright specs out
    // next-auth imports "next/server" without an extension; Node ESM needs Vite to resolve it.
    server: { deps: { inline: ["next-auth"] } },
  },
});
