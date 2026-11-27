import { type Browser, expect, type Locator, type Page, test } from "@playwright/test";
import postgres from "postgres";
import { signInAs } from "./helpers";

// One menu is built, then read; the tests run in order. The menu is site-wide: afterAll empties it.
test.describe.configure({ mode: "serial" });

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const run = crypto.randomUUID().slice(0, 8);
const titles = { about: `About ${run}`, team: `Team ${run}`, history: `History ${run}`, secret: `Secret ${run}` };
const slugs = Object.keys(titles).map((name) => `e2e-menu-${name}-${run}`);
const userIds: string[] = [];
let secretId = "";

test.beforeAll(async () => {
  for (const [i, [name, title]] of Object.entries(titles).entries()) {
    const draft = { root: { props: { title } }, content: [] };
    const [{ id }] = await sql`insert into pages (id, slug, title, draft) values (${crypto.randomUUID()}, ${slugs[i]}, ${title}, ${sql.json(draft)}) returning id`;
    if (name === "secret") secretId = id;
    else {
      const [rev] = await sql`insert into page_revisions (id, "pageId", data) values (${crypto.randomUUID()}, ${id}, ${sql.json(draft)}) returning id`;
      await sql`update pages set "publishedRevisionId" = ${rev.id} where id = ${id}`;
    }
  }
});

test.afterAll(async () => {
  await sql`delete from menu_items`;
  await sql`delete from pages where slug in ${sql(slugs)}`; // cascades to page_revisions
  if (userIds.length) await sql`delete from users where id in ${sql(userIds)}`; // and to the sessions
  await sql.end();
});

async function signedIn(browser: Browser, baseURL: string, role: "admin" | "editor"): Promise<Page> {
  const context = await browser.newContext();
  userIds.push((await signInAs(sql, context, baseURL, role)).id);
  return context.newPage();
}

async function fillItem(item: Locator, label: string, link: { page: string } | { url: string }) {
  await item.getByLabel("Label").first().fill(label);
  if ("page" in link) await item.getByLabel("Page").first().selectOption({ label: link.page });
  else {
    await item.getByLabel("Link to").first().selectOption("url");
    await item.getByLabel("URL").first().fill(link.url);
  }
}

test("admin-builds-menu-shows-public", async ({ browser, baseURL }) => {
  const page = await signedIn(browser, baseURL!, "admin");
  // A page rendered before the save: the save must expire it.
  await page.goto(`/${slugs[0]}`);
  await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);

  await page.goto("/admin/menu");
  const item = (name: string) => page.getByRole("group", { name, exact: true });
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Add item" }).click();
  await fillItem(item("Item 1"), "About", { page: titles.about });
  await fillItem(item("Item 2"), "Donate", { url: "https://example.org/donate" });
  await fillItem(item("Item 3"), "Our work", { page: titles.team });
  await item("Item 3").getByRole("button", { name: "Add child Item 3" }).click();
  await item("Item 3").getByRole("button", { name: "Add child Item 3" }).click();
  await fillItem(item("Item 3.1"), "Team", { page: titles.team });
  await fillItem(item("Item 3.2"), "History", { page: titles.history });
  await expect(item("Item 4").getByRole("option", { name: `${titles.secret} (not published)` })).toHaveCount(1);
  await fillItem(item("Item 4"), "Secret plans", { page: `${titles.secret} (not published)` });
  await page.getByRole("button", { name: "Save menu" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");

  await page.goto(`/${slugs[0]}`);
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: "About" })).toHaveAttribute("href", `/${slugs[0]}`);
  await expect(nav.getByRole("link", { name: "About" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Donate" })).toHaveAttribute("href", "https://example.org/donate");
  await expect(nav.getByRole("link", { name: "Our work" })).toHaveAttribute("href", `/${slugs[1]}`);
  // The editor shows the saved menu again.
  await page.goto("/admin/menu");
  await expect(item("Item 3.2").getByLabel("Label")).toHaveValue("History");
  await page.context().close();
});

test("unpublished-link-absent", async ({ page }) => {
  const response = await page.goto("/");
  expect(await response!.text()).not.toContain("Secret plans");
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link")).toHaveCount(3);
});

test("menu-keyboard-dropdown", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: "Team" })).toBeHidden();
  await nav.getByRole("link", { name: "Our work" }).focus();
  await page.keyboard.press("Tab");
  await expect(nav.getByLabel("More in Our work")).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(nav.getByRole("link", { name: "Team" })).toBeFocused();
  await expect(nav.getByRole("link", { name: "History" })).toBeVisible();
});

test("mobile-menu-opens", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: "About" })).toBeHidden();
  await nav.getByText("Menu", { exact: true }).click();
  await expect(nav.getByRole("link", { name: "About" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "History" })).toBeHidden();
  await nav.getByLabel("More in Our work").click();
  await expect(nav.getByRole("link", { name: "History" })).toBeVisible();
  await context.close();
});

test("publish-shows-linked-page", async ({ browser, baseURL }) => {
  const page = await signedIn(browser, baseURL!, "editor");
  await page.goto(`/admin/pages/${secretId}/edit`);
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByRole("status").filter({ hasText: /^Published$/ })).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Secret plans" })).toHaveAttribute(
    "href",
    `/${slugs[3]}`,
  );
  await page.context().close();
});

test("editor-gets-403", async ({ browser, baseURL }) => {
  const page = await signedIn(browser, baseURL!, "editor");
  // The guard runs inside Suspense after the stream starts, so the status stays 200: assert the text.
  await page.goto("/admin/menu");
  await expect(page.getByText("You do not have access to this page.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Menu" })).toHaveCount(0);
  await page.goto("/admin");
  await expect(page.getByRole("link", { name: "Pages" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Menu" })).toHaveCount(0);
  await page.context().close();
});
