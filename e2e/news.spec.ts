import { type Browser, expect, type Page, test } from "@playwright/test";
import postgres from "postgres";
import { BRAND_DEFAULTS } from "../src/brand";
import { signInAs } from "./helpers";

// One post goes through create, publish, date change and restore, so the tests run in order.
test.describe.configure({ mode: "serial" });

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const run = crypto.randomUUID().slice(0, 8);
const slug = `e2e-news-${run}`;
const first = `First news ${run}`;
const second = `Second news ${run}`;
const userIds: string[] = [];
let editUrl = "";

test.afterAll(async () => {
  await sql`delete from pages where slug = ${slug}`; // cascades to page_revisions
  if (userIds.length) await sql`delete from users where id in ${sql(userIds)}`; // and to the sessions
  await sql.end();
});

async function signedIn(browser: Browser, baseURL: string, role: "admin" | "editor"): Promise<Page> {
  const context = await browser.newContext();
  userIds.push((await signInAs(sql, context, baseURL, role)).id);
  return context.newPage();
}

async function publish(page: Page, title: string) {
  await page.getByRole("textbox", { name: "Title" }).fill(title);
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByRole("status").filter({ hasText: /^Published$/ })).toBeVisible();
}

test("editor-publishes-post", async ({ browser, baseURL }) => {
  const page = await signedIn(browser, baseURL!, "editor");
  await page.goto("/admin/news");
  const form = page.getByRole("form", { name: "New post" });
  await form.getByLabel("Title").fill(first);
  await form.getByLabel("Slug").fill(slug);
  await form.getByRole("button", { name: "Create post" }).click();
  await expect(page).toHaveURL(/\/admin\/pages\/[\w-]+\/edit$/);
  editUrl = page.url();

  expect((await page.goto(`/news/${slug}`))?.status()).toBe(404);
  await page.goto(editUrl);
  await publish(page, first);
  await page.goto(`/news/${slug}`);
  await expect(page).toHaveTitle(`${first} · ${BRAND_DEFAULTS.siteName}`);
  await expect(page.getByRole("heading", { level: 1, name: first })).toBeVisible();
  const today = new Date().toISOString().slice(0, 10);
  await expect(page.locator("article time")).toHaveAttribute("datetime", new RegExp(`^${today}`));
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "article");
  // A post is not a page, and /news has no index yet (#22).
  expect((await page.goto(`/${slug}`))?.status()).toBe(404);
  expect((await page.goto("/news"))?.status()).toBe(404);

  // The list shows it as live; the pages list does not show it.
  await page.goto("/admin/news");
  await expect(page.locator("tbody tr").filter({ hasText: first })).toContainText("Live");
  await page.goto("/admin/pages");
  await expect(page.getByText(first)).toHaveCount(0);

  // The editor moves the date back; the public post shows it with no restart.
  await page.goto(editUrl.replace(/\/edit$/, "/history"));
  const dateForm = page.getByRole("form", { name: "Publish date" });
  await dateForm.getByLabel("Publish date (UTC)").fill("2026-01-15");
  await dateForm.getByRole("button", { name: "Save date" }).click();
  await expect(dateForm.getByText("Saved")).toBeVisible();
  await page.goto(`/news/${slug}`);
  await expect(page.locator("article time")).toHaveText("January 15, 2026");
  await page.context().close();
});

test("admin-restores-post", async ({ browser, baseURL }) => {
  const editor = await signedIn(browser, baseURL!, "editor");
  await editor.goto(editUrl);
  await publish(editor, second);
  await editor.context().close();

  const page = await signedIn(browser, baseURL!, "admin");
  await page.goto(editUrl.replace(/\/edit$/, "/history"));
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("tbody tr").filter({ hasText: first }).getByRole("button", { name: "Restore" }).click();
  await expect(page.getByText("Restored", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: `/news/${slug}` })).toBeVisible();
  await page.goto(`/news/${slug}`);
  await expect(page).toHaveTitle(`${first} · ${BRAND_DEFAULTS.siteName}`);
  // Restore keeps the publish date.
  await expect(page.locator("article time")).toHaveText("January 15, 2026");
  await page.context().close();
});
