import type { BrowserContext } from "@playwright/test";
import type postgres from "postgres";

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
