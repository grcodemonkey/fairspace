import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import postgres from "postgres";
import { signInAs as seedSession } from "./helpers";

const MAILPIT = "http://localhost:8025";
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const seededIds: string[] = [];
const seededEmails: string[] = [];

test.afterAll(async () => {
  await sql`delete from users where id = any(${seededIds}) or email = any(${seededEmails})`;
  await sql.end();
});

async function signInAs(context: BrowserContext,baseURL: string, role: "admin" | "editor") {
  const user = await seedSession(sql, context, baseURL, role);
  seededIds.push(user.id);
  return user;
}

const row = (page: Page, email: string) => page.getByRole("row").filter({ hasText: email });

test("admin-invites-user", async ({ page, context, baseURL }) => {
  await signInAs(context, baseURL!, "admin");
  const email = `invited-${crypto.randomUUID()}@example.com`;
  seededEmails.push(email);

  await page.goto("/admin/users");
  await page.getByLabel("Email").fill(email.toUpperCase());
  await page.getByRole("button", { name: "Invite" }).click();

  await expect(page.getByText(`Invited ${email}.`)).toBeVisible();
  await expect(row(page, email)).toContainText("Editor");
  // The normal magic-link email reaches the invited user.
  await expect
    .poll(async () => {
      const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
      return ((await res.json()).messages ?? []).length;
    })
    .toBe(1);
  // Sending the invite does not disturb the admin's own session.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();

  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Invite" }).click();
  await expect(page.getByText("Already a user.")).toBeVisible();
});

test("admin-changes-role", async ({ page, context, baseURL, browser }) => {
  await signInAs(context, baseURL!, "admin");
  const other = await browser.newContext();
  const { id, email } = await signInAs(other, baseURL!, "editor");
  await other.close();

  await page.goto("/admin/users");
  await row(page, email).getByRole("button", { name: "Change to admin" }).click();
  await expect(row(page, email)).toContainText("Admin");
  expect(await sql`select role from users where id = ${id}`).toEqual([{ role: "admin" }]);
});

test("removed-user-signed-out", async ({ page, context, baseURL, browser }) => {
  await signInAs(context, baseURL!, "admin");
  const victimContext = await browser.newContext({ baseURL });
  const victim = await victimContext.newPage();
  const { email } = await signInAs(victimContext, baseURL!, "editor");
  await victim.goto("/admin");
  await expect(victim.getByText(`Signed in as ${email}`)).toBeVisible();

  await page.goto("/admin/users");
  page.once("dialog", (dialog) => dialog.accept());
  await row(page, email).getByRole("button", { name: "Remove" }).click();
  await expect(row(page, email)).toHaveCount(0);

  await victim.reload();
  await expect(victim).toHaveURL(/\/sign-in$/);
  await victimContext.close();
});
