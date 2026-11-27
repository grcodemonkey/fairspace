import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import postgres from "postgres";
import { BRAND_DEFAULTS } from "../src/brand";
import { getStorage } from "../src/storage";
import { signInAs as seedSession } from "./helpers";

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const seeded: string[] = [];
const SHARE_FILE = "seo-default.png";
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);
const run = crypto.randomUUID().slice(0, 8);
const slug = `e2e-brand-${run}`;

async function signInAs(context: BrowserContext, baseURL: string, role: "admin" | "editor") {
  const user = await seedSession(sql, context, baseURL, role);
  seeded.push(user.id);
  return user;
}

test.beforeAll(async () => {
  // Publish by hand until #12 adds a publish action.
  const doc = { root: { props: { title: "Brand page" } }, content: [] };
  await sql`insert into pages (id, title, slug, draft) values (${crypto.randomUUID()}, 'Brand page', ${slug}, ${sql.json(doc)})`;
  const [rev] = await sql`insert into page_revisions (id, "pageId", data)
    select ${crypto.randomUUID()}, id, ${sql.json(doc)} from pages where slug = ${slug} returning id`;
  await sql`update pages set "publishedRevisionId" = ${rev.id} where slug = ${slug}`;
});

// Other specs expect the default brand: the test saves the defaults back, and the row goes here.
test.afterAll(async () => {
  await sql`delete from site_settings`;
  const files = await sql`delete from media where filename = ${SHARE_FILE} returning key`;
  const { client, bucket } = getStorage();
  for (const { key } of files) await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => {});
  await sql`delete from pages where slug = ${slug}`;
  if (seeded.length) await sql`delete from users where id = any(${seeded})`;
  await sql.end();
});

async function saveBrand(page: Page, brand: { name: string; light: string; dark: string; font: string }) {
  await page.goto("/admin/settings");
  await page.getByLabel("Site name").fill(brand.name);
  await page.getByLabel("Primary color, light mode").fill(brand.light);
  await page.getByLabel("Primary color, dark mode").fill(brand.dark);
  await page.getByLabel("Font").selectOption(brand.font);
  await page.getByRole("button", { name: "Save brand" }).click();
  await expect(page.locator("#brand").getByRole("status")).toHaveText("Saved.");
}

const primaryOf = (page: Page) =>
  page.locator(".brand").evaluate((el) => getComputedStyle(el).getPropertyValue("--color-primary").trim());

// Proves updateTag("site-settings") refreshes public pages that were already rendered and cached.
test("brand-save-updates-public-pages", async ({ page, context, baseURL }) => {
  for (const path of ["/", `/${slug}`]) {
    await page.goto(path);
    await expect(page.getByRole("banner").getByRole("link", { name: BRAND_DEFAULTS.siteName })).toBeVisible();
  }

  await signInAs(context, baseURL!, "admin");
  await page.goto("/admin");
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

  // A color under 4.5:1 is refused with its ratio.
  await page.getByLabel("Primary color, light mode").fill("#9ca3af");
  await page.getByRole("button", { name: "Save brand" }).click();
  await expect(page.locator("#brand").getByRole("status")).toHaveText(/2\.5:1 contrast on the light background, needs 4\.5:1/);

  const name = `Riverside ${run}`;
  await saveBrand(page, { name, light: "#047857", dark: "#34d399", font: "serif" });

  for (const path of ["/", `/${slug}`]) {
    await page.goto(path);
    await expect(page.getByRole("banner").getByRole("link", { name })).toBeVisible();
    expect(await primaryOf(page)).toBe("#047857");
  }
  await expect(page).toHaveTitle(`Brand page · ${name}`);
  await page.emulateMedia({ colorScheme: "dark" });
  expect(await primaryOf(page)).toBe("#34d399");
  await page.emulateMedia({ colorScheme: "light" });

  const { siteName, primaryLight, primaryDark, font } = BRAND_DEFAULTS;
  await saveBrand(page, { name: siteName, light: primaryLight, dark: primaryDark, font });
  await page.goto("/");
  expect(await primaryOf(page)).toBe(primaryLight);
});

// The guard runs inside Suspense after the stream starts, so the status stays 200: assert the text.
test("editor-refused-settings", async ({ page, context, baseURL }) => {
  await signInAs(context, baseURL!, "editor");
  await page.goto("/admin/settings");
  await expect(page.getByText("You do not have access to this page.")).toBeVisible();
  await expect(page.getByLabel("Site name")).toHaveCount(0);
  await page.goto("/admin");
  await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);
});

test("seo-defaults-reach-pages", async ({ page, context, baseURL, request }) => {
  await signInAs(context, baseURL!, "admin");
  await page.goto("/admin/settings");
  await page.getByLabel("Default description").fill("We feed the river valley.");
  const seo = page.locator("#search-and-sharing");
  await seo.getByRole("button", { name: "Choose media" }).click();
  await page.getByRole("dialog").getByLabel("Upload a file").setInputFiles({ name: SHARE_FILE, mimeType: "image/png", buffer: PNG });
  await expect(seo.getByRole("button", { name: "Remove" })).toBeVisible();
  await seo.getByRole("button", { name: "Save search and sharing" }).click();
  await expect(seo.getByRole("status")).toHaveText("Saved.");

  const [{ id }] = await sql`select id from media where filename = ${SHARE_FILE}`;
  // The page has no description or image of its own, so it shows the defaults.
  await page.goto(`/${slug}`);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", "We feed the river valley.");
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute("content", "We feed the river valley.");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", `http://localhost:3000/media/${id}.png`);
  // The welcome page (no published home page) gets them from the site layout.
  const home = await request.get("/");
  expect(await home.text()).toContain("We feed the river valley.");

  // The file is in use: the media library refuses to delete it.
  await page.goto("/admin/media");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("listitem").filter({ hasText: SHARE_FILE }).getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Used as the site share image.")).toBeVisible();
});
