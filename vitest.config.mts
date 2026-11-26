import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// Set on process.env (not test.env) so globalSetup in the main process sees it too; workers inherit it.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://fairspace:fairspace@localhost:5433/fairspace_test";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    globalSetup: "./vitest.global-setup.ts",
    include: ["src/**/*.test.{ts,tsx}"], // keep Playwright specs out
  },
});
