import { expect, test } from "@playwright/test";
import postgres from "postgres";

const MAILPIT = "http://localhost:8025";
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

test.afterAll(() => sql.end());

// Mailpit is shared by all local worktrees, so every run uses its own address.
const uniqueEmail = (label: string) => `${label}-${crypto.randomUUID()}@example.com`;

async function mailpitMessages(to: string): Promise<{ ID: string }[]> {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
  return (await res.json()).messages ?? [];
}

async function submitSignIn(page: import("@playwright/test").Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
}

test("a known user signs in with a magic link and signs out", async ({ page }) => {
  const email = uniqueEmail("known");
  await sql`insert into users (id, email) values (${crypto.randomUUID()}, ${email})`;

  await submitSignIn(page, email);

  await expect.poll(async () => (await mailpitMessages(email)).length).toBe(1);
  const [{ ID }] = await mailpitMessages(email);
  const message = await (await fetch(`${MAILPIT}/api/v1/message/${ID}`)).json();
  const link = (message.Text as string).match(/http\S+\/api\/auth\/callback\/nodemailer\?\S+/)?.[0];
  expect(link).toBeTruthy();

  await page.goto(link!);
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
