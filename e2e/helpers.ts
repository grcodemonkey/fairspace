import type AxeBuilder from "@axe-core/playwright";
import { type BrowserContext, expect, type TestInfo } from "@playwright/test";
import type postgres from "postgres";

// A 16×16 red PNG.
export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGO4IydHEmIY1TCqYfhqAACaMxgQdGu1YAAAAABJRU5ErkJggg==",
  "base64",
);

// WCAG 2.2 AA (#17, #53).
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** Runs axe and fails with one readable line per violation; the full JSON goes in the HTML report. The caller scopes the builder. */
export async function expectNoViolations(builder: AxeBuilder, testInfo: TestInfo, name: string) {
  const { violations } = await builder.withTags(TAGS).analyze();
  await testInfo.attach(`axe-${name}.json`, { body: JSON.stringify(violations, null, 2), contentType: "application/json" });
  const report = violations
    .map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} nodes: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(", ")}\n  ${v.helpUrl}`)
    .join("\n");
  // Soft: every scan in the test runs, so one CI run lists every rule that fails.
  expect.soft(violations.map((v) => v.id), `axe ${name}:\n${report}`).toEqual([]);
}

// Skips Mailpit: a users row plus a sessions row is what a magic-link sign-in leaves behind.
// The caller deletes the user by id afterwards; the cascade removes the session.
export async function signInAs(sql: postgres.Sql, context: BrowserContext, baseURL: string, role: "admin" | "editor") {
  const id = crypto.randomUUID();
  const email = `${role}-${id}@example.com`;
  const token = crypto.randomUUID();
  await sql`insert into users (id, email, role) values (${id}, ${email}, ${role})`;
  await sql`insert into sessions ("sessionToken", "userId", expires) values (${token}, ${id}, now() + interval '1 day')`;
  await context.addCookies([{ name: "authjs.session-token", value: token, url: baseURL }]);
  return { id, email };
}
