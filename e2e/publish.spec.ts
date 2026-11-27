import { type Browser, expect, type Page, test } from "@playwright/test";
import postgres from "postgres";
import { signInAs } from "./helpers";

// One page goes through publish, history, restore and unpublish, so the tests run in order.
test.describe.configure({ mode: "serial" });

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const run = crypto.randomUUID().slice(0, 8);
const slug = `e2e-publish-${run}`; // never `home`: the slug is unique and the DB can already have one
const first = `First title ${run}`;
const second = `Second title ${run}`;
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
  // Puck's drag-and-drop adds its own status regions, so pick ours by its text.
  await expect(page.getByRole("status").filter({ hasText: /^Published$/ })).toBeVisible();
}

test("editor-publishes-live", async ({ browser, baseURL }) => {
  const page = await signedIn(browser, baseURL!, "editor");
  await page.goto("/admin/pages");
  const form = page.getByRole("form", { name: "New page" });
  await form.getByLabel("Title").fill(first);
  await form.getByLabel("Slug").fill(slug);
  await form.getByRole("button", { name: "Create page" }).click();
  await expect(page).toHaveURL(/\/admin\/pages\/[\w-]+\/edit$/);
  editUrl = page.url();

  expect((await page.goto(`/${slug}`))?.status()).toBe(404);
  await page.goto(editUrl);
  await publish(page, first);
  await page.goto(`/${slug}`);
  await expect(page).toHaveTitle(first);

  // The second publish shows with no restart: updateTag expired the cached page.
  await page.goto(editUrl);
  await publish(page, second);
  await page.goto(`/${slug}`);
  await expect(page).toHaveTitle(second);
  await page.context().close();
});

test("editor-cannot-restore", async ({ browser, baseURL }) => {
  const page = await signedIn(browser, baseURL!, "editor");
  await page.goto(editUrl.replace(/\/edit$/, "/history"));
  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("Live");
  await expect(page.getByRole("button", { name: "Restore" })).toHaveCount(0);
  await page.context().close();
});

test("admin-restores", async ({ browser, baseURL }) => {
  const page = await signedIn(browser, baseURL!, "admin");
  await page.goto(editUrl.replace(/\/edit$/, "/history"));
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("tbody tr").filter({ hasText: first }).getByRole("button", { name: "Restore" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(3);
  await expect(page.getByText("Restored", { exact: true })).toBeVisible();
  await page.goto(`/${slug}`);
  await expect(page).toHaveTitle(first);
  await page.context().close();
});

test("unpublish-404", async ({ browser, baseURL }) => {
  const page = await signedIn(browser, baseURL!, "editor");
  await page.goto(editUrl.replace(/\/edit$/, "/history"));
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Unpublish" }).click();
  await expect(page.getByText("Not published")).toBeVisible();
  expect((await page.goto(`/${slug}`))?.status()).toBe(404);
  await page.context().close();
});
