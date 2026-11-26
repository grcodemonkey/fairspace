import { type BrowserContext, expect, test } from "@playwright/test";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const seeded: string[] = [];

// Skips Mailpit: a users row plus a sessions row is what a magic-link sign-in leaves behind.
async function signInAs(context: BrowserContext, baseURL: string, role: "admin" | "editor") {
  const id = crypto.randomUUID();
  const email = `${role}-${id}@example.com`;
  const token = crypto.randomUUID();
  await sql`insert into users (id, email, role) values (${id}, ${email}, ${role})`;
  await sql`insert into sessions ("sessionToken", "userId", expires) values (${token}, ${id}, now() + interval '1 day')`;
  seeded.push(id);
  await context.addCookies([{ name: "authjs.session-token", value: token, url: baseURL }]);
  return email;
}

// The cascade removes the sessions.
test.afterAll(async () => {
  await sql`delete from users where id = any(${seeded})`;
  await sql.end();
});

// The guard runs inside Suspense after the stream starts, so the status stays 200: assert the text.
test("editor-sees-dashboard", async ({ page, context, baseURL }) => {
  const email = await signInAs(context, baseURL!, "editor");
  await page.goto("/admin");
  await expect(page.getByText(`Signed in as ${email} · Editor`)).toBeVisible();
  await expect(page.getByRole("link", { name: "Users" })).toHaveCount(0);
});

test("editor-refused-users-page", async ({ page, context, baseURL }) => {
  await signInAs(context, baseURL!, "editor");
  await page.goto("/admin/users");
  await expect(page.getByText("You do not have access to this page.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Users" })).toHaveCount(0);
});

test("admin-opens-users-page", async ({ page, context, baseURL }) => {
  const email = await signInAs(context, baseURL!, "admin");
  await page.goto("/admin");
  await expect(page.getByText(`Signed in as ${email} · Admin`)).toBeVisible();
  await page.getByRole("link", { name: "Users" }).click();
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
});

test("signed-out-redirected", async ({ page }) => {
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/sign-in$/);
});
