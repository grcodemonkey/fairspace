import { type BrowserContext, expect, test } from "@playwright/test";
import postgres from "postgres";
import { signInAs as seedSession } from "./helpers";

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const seeded: string[] = [];

async function signInAs(context: BrowserContext, baseURL: string, role: "admin" | "editor") {
  const user = await seedSession(sql, context, baseURL, role);
  seeded.push(user.id);
  return user;
}

// The cascade removes the sessions.
test.afterAll(async () => {
  if (seeded.length) await sql`delete from users where id = any(${seeded})`;
  await sql.end();
});

// The guard runs inside Suspense after the stream starts, so the status stays 200: assert the text.
test("editor-sees-dashboard", async ({ page, context, baseURL }) => {
  const { email } = await signInAs(context, baseURL!, "editor");
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
  const { email } = await signInAs(context, baseURL!, "admin");
  await page.goto("/admin");
  await expect(page.getByText(`Signed in as ${email} · Admin`)).toBeVisible();
  await page.getByRole("link", { name: "Users" }).click();
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
});

// Database sessions re-read the users row on each request, so no new sign-in is needed.
test("role-change-applies-next-request", async ({ page, context, baseURL }) => {
  const { id, email } = await signInAs(context, baseURL!, "editor");
  await page.goto("/admin");
  await expect(page.getByText(`Signed in as ${email} · Editor`)).toBeVisible();
  await sql`update users set role = 'admin' where id = ${id}`;
  await page.reload();
  await expect(page.getByText(`Signed in as ${email} · Admin`)).toBeVisible();
  await expect(page.getByRole("link", { name: "Users" })).toBeVisible();
});

test("signed-out-redirected", async ({ page }) => {
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/sign-in$/);
});
