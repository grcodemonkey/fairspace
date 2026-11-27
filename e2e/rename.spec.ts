import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { signInAs } from "./helpers";

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const run = crypto.randomUUID().slice(0, 8);
const oldSlug = `e2e-rename-${run}`;
const newSlug = `e2e-renamed-${run}`;
let userId = "";

test.afterAll(async () => {
  await sql`delete from pages where slug in (${oldSlug}, ${newSlug})`; // cascades to revisions and redirects
  if (userId) await sql`delete from users where id = ${userId}`;
  await sql.end();
});

test("rename-redirects-old-address", async ({ browser, baseURL, request }) => {
  const context = await browser.newContext();
  userId = (await signInAs(sql, context, baseURL!, "editor")).id;
  const page = await context.newPage();
  await page.goto("/admin/pages");
  const create = page.getByRole("form", { name: "New page" });
  await create.getByLabel("Title").fill(`Rename ${run}`);
  await create.getByLabel("Slug").fill(oldSlug);
  await create.getByRole("button", { name: "Create page" }).click();
  await expect(page).toHaveURL(/\/admin\/pages\/([\w-]+)\/edit$/);
  const id = page.url().match(/pages\/([\w-]+)\/edit/)![1];
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByRole("status").filter({ hasText: /^Published$/ })).toBeVisible();

  // Warm the cache for the new address: a cached 404 must not survive the rename.
  expect((await request.get(`/${newSlug}`)).status()).toBe(404);
  expect((await request.get(`/${oldSlug}`)).status()).toBe(200);

  await page.goto(`/admin/pages/${id}/history`);
  const form = page.getByRole("form", { name: "Address" });
  await expect(form.getByLabel("Address")).toHaveValue(oldSlug);
  await form.getByLabel("Address").fill(newSlug);
  await form.getByRole("button", { name: "Change address" }).click();
  await expect(form.getByText("Saved")).toBeVisible();

  const moved = await request.get(`/${oldSlug}`, { maxRedirects: 0 });
  expect(moved.status()).toBe(308);
  // Next repeats the location header on a static redirect (/home does too), so the value can read "x, x".
  expect(new URL(moved.headers().location.split(",")[0], baseURL!).pathname).toBe(`/${newSlug}`);
  expect((await request.get(`/${newSlug}`)).status()).toBe(200);
  await page.goto(`/${oldSlug}`);
  await expect(page).toHaveURL(`/${newSlug}`);

  // Another page cannot take the old address.
  await page.goto("/admin/pages");
  await create.getByLabel("Title").fill(`Taken ${run}`);
  await create.getByLabel("Slug").fill(oldSlug);
  await create.getByRole("button", { name: "Create page" }).click();
  await expect(page.getByText("That slug is in use.")).toBeVisible();
  await context.close();
});
