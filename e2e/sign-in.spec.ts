import { expect, test } from "@playwright/test";
import postgres from "postgres";

const MAILPIT = "http://localhost:8025";
// Written out, not imported from src/auth.ts, so the test also catches a change to Auth.js's own redirect.
const CHECK_EMAIL_URL = "http://localhost:3000/sign-in/check-email?provider=nodemailer&type=email";
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

test.afterAll(() => sql.end());

// Mailpit is shared by all local worktrees, so every run uses its own address.
const uniqueEmail = (label: string) => `${label}-${crypto.randomUUID()}@example.com`;

async function mailpitMessages(to: string): Promise<{ ID: string }[]> {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
  return (await res.json()).messages ?? [];
}

async function linkFrom(id: string): Promise<string> {
  const message = await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json();
  const link = (message.Text as string).match(/http\S+\/api\/auth\/callback\/nodemailer\?\S+/)?.[0];
  expect(link).toBeTruthy();
  return link!;
}

async function submitSignIn(page: import("@playwright/test").Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  // Known and unknown emails must end on this exact URL, or the URL shows which emails have an account.
  await expect(page).toHaveURL(CHECK_EMAIL_URL);
}

test("a known user signs in with a magic link and signs out", async ({ page }) => {
  const email = uniqueEmail("known");
  await sql`insert into users (id, email) values (${crypto.randomUUID()}, ${email})`;

  await submitSignIn(page, email);

  await expect.poll(async () => (await mailpitMessages(email)).length).toBe(1);
  const [{ ID }] = await mailpitMessages(email);

  await page.goto(await linkFrom(ID));
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/sign-in$/);

  const sessions = await sql`select 1 from sessions s join users u on u.id = s."userId" where u.email = ${email}`;
  expect(sessions).toHaveLength(0);
});

test("an unknown email sees the same page, gets no email, and creates no user", async ({ page }) => {
  const email = uniqueEmail("unknown");

  await submitSignIn(page, email);

  expect(await mailpitMessages(email)).toHaveLength(0);
  expect(await sql`select 1 from users where email = ${email}`).toHaveLength(0);
});

const ADMIN_EMAIL = "admin-e2e@example.com"; // ADMIN_EMAIL in playwright.config.ts

test.describe("first admin", () => {
  // Start from "no admin exists" in the test database (unit tests roll back and leave no admin).
  test.beforeAll(async () => {
    await sql`delete from users where role = 'admin'`;
  });
  test.afterAll(async () => {
    await sql`delete from users where email = ${ADMIN_EMAIL}`;
  });

  test("the first sign-in with ADMIN_EMAIL creates the admin", async ({ page }) => {
    const email = ADMIN_EMAIL;
    // Mailpit is shared and the address is fixed, so only messages that arrive after the submit count.
    const before = new Set((await mailpitMessages(email)).map((m) => m.ID));

    await submitSignIn(page, email.toUpperCase());

    let id: string | undefined;
    await expect
      .poll(async () => (id = (await mailpitMessages(email)).find((m) => !before.has(m.ID))?.ID))
      .toBeTruthy();
    await page.goto(await linkFrom(id!));
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
    expect(await sql`select role from users where email = ${email}`).toEqual([{ role: "admin" }]);
  });
});
