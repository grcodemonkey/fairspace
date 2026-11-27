// Vercel build entry (see vercel.json): check the environment, migrate production, then `next build` runs.
// Not part of `pnpm build`, so CI and local builds need no env vars.
import { execFileSync } from "node:child_process";

export const REQUIRED_ENV = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "EMAIL_SERVER",
  "EMAIL_FROM",
  "ADMIN_EMAIL",
  "S3_ENDPOINT",
  "S3_REGION",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
];

// Names only, never values: build logs are readable by the team.
export function missingEnv(env: Record<string, string | undefined> = process.env): string[] {
  return REQUIRED_ENV.filter((name) => !env[name]?.trim());
}

function main() {
  const missing = missingEnv();
  if (missing.length > 0) {
    const hint = missing.includes("DATABASE_URL")
      ? "\nDATABASE_URL: add the Neon integration (Project -> Storage tab) or paste a Postgres URL."
      : "";
    console.error(
      "Fairspace cannot deploy. Set these environment variables in Vercel " +
        "(Project -> Settings -> Environment Variables), then redeploy:\n" +
        missing.map((name) => `  ${name}`).join("\n") +
        hint +
        "\nDetails: https://github.com/grcodemonkey/fairspace#deploy-to-vercel",
    );
    process.exit(1);
  }
  // Previews skip migrations: Neon preview branching is off by default, so a preview shares the
  // production database, and an unmerged PR must never change the production schema.
  if (process.env.VERCEL_ENV === "production") {
    execFileSync("pnpm", ["db:migrate"], { stdio: "inherit" });
  } else {
    console.log("Preview build: migrations skipped");
  }
}

if (process.argv[1]?.endsWith("vercel-build.ts")) main();
