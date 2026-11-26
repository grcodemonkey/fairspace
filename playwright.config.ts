import { defineConfig, devices } from "@playwright/test";

// Same test database as vitest.config.mts. Set on process.env so globalSetup and the specs see it.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://fairspace:fairspace@localhost:5433/fairspace_test";

export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Migrates the test database; refuses any database whose name does not end in _test.
  globalSetup: "./vitest.global-setup.ts",
  use: { baseURL: "http://localhost:3000" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // CI builds in its own step (with no env) to prove the build needs no secrets.
    command: process.env.CI ? "pnpm start" : "pnpm build && pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL,
      AUTH_SECRET: "e2e-test-secret-not-for-production",
      AUTH_URL: "http://localhost:3000",
      EMAIL_SERVER: "smtp://localhost:1025",
      EMAIL_FROM: "Fairspace <noreply@localhost>",
    },
  },
});
