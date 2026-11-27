import AxeBuilder from "@axe-core/playwright";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { type Browser, expect, type Locator, type Page, test, type TestInfo } from "@playwright/test";
import postgres from "postgres";
import { expectNoViolations, PNG, signInAs } from "./helpers";

// #53: axe (WCAG 2.2 AA) on every admin and sign-in page, light and dark, desktop only, plus the states a user sees
// often: a form error, the media picker open, the forbidden page. Nothing here saves shared data: the brand error is
// refused before the save, and the menu is only viewed. Not serial: a failed light scan must not skip the dark one.

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  forcePathStyle: true,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
});
const run = crypto.randomUUID().slice(0, 8);
const slug = `e2e-admin-a11y-${run}`;
const postSlug = `e2e-admin-a11y-post-${run}`;
const mediaId = crypto.randomUUID();
const mediaKey = `media/${mediaId}.png`;
const filename = `admin-a11y-${run}.png`;
const userIds: string[] = [];
let pageId = "";
let revisionId = "";

test.beforeAll(async () => {
  await s3.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: mediaKey, Body: PNG, ContentType: "image/png" }));
  // No alt text: the media list shows its "No alt text" badge.
  await sql`insert into media (id, key, filename, "contentType", size, "uploadedAt")
    values (${mediaId}, ${mediaKey}, ${filename}, 'image/png', ${PNG.length}, now())`;
  // A Heading only: the revision preview has no third-party frames.
  const data = {
    root: { props: { title: "Admin a11y" } },
    content: [{ type: "Heading", props: { id: "Heading-1", text: "Admin a11y", level: "h2", align: "left" } }],
  };
  [{ id: pageId }] = await sql`insert into pages (id, title, slug, draft)
    values (${crypto.randomUUID()}, 'Admin a11y', ${slug}, ${sql.json(data)}) returning id`;
  [{ id: revisionId }] = await sql`insert into page_revisions (id, "pageId", data)
    values (${crypto.randomUUID()}, ${pageId}, ${sql.json(data)}) returning id`;
  await sql`update pages set "publishedRevisionId" = ${revisionId}, "publishedAt" = now() where id = ${pageId}`;
  // A draft post: the news list is not empty.
  await sql`insert into pages (id, title, slug, kind, draft)
    values (${crypto.randomUUID()}, 'Admin a11y post', ${postSlug}, 'post', ${sql.json(data)})`;
});

test.afterAll(async () => {
  try {
    await sql`delete from pages where slug in ${sql([slug, postSlug])}`; // cascades to page_revisions
    await sql`delete from media where id = ${mediaId}`;
    if (userIds.length) await sql`delete from users where id in ${sql(userIds)}`; // and to the sessions
  } finally {
    await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: mediaKey }));
    await sql.end();
  }
});

async function newPage(browser: Browser, baseURL: string, colorScheme: "light" | "dark", role?: "admin" | "editor") {
  const context = await browser.newContext({ baseURL, colorScheme, viewport: { width: 1440, height: 900 } });
  // No third-party traffic: the scan does not depend on the network.
  await context.route(/^(?!http:\/\/localhost:3000\/)/, (route) => route.abort());
  if (role) userIds.push((await signInAs(sql, context, baseURL, role)).id);
  return context.newPage();
}

/** Opens the URL, waits until the streamed content is there, and scans the whole page. */
async function visit(page: Page, url: string, ready: (page: Page) => Locator, testInfo: TestInfo, name: string) {
  await page.goto(url);
  await expect(ready(page)).toBeVisible();
  await page.waitForLoadState("networkidle"); // hydrated
  await expectNoViolations(new AxeBuilder({ page }), testInfo, name);
}

const h1 = (name: string | RegExp) => (page: Page) => page.getByRole("heading", { level: 1, name });

for (const colorScheme of ["light", "dark"] as const) {
  test(`axe-admin-${colorScheme}`, async ({ browser, baseURL }, testInfo) => {
    test.setTimeout(180_000);
    const scan = (page: Page, url: string, ready: (page: Page) => Locator, name: string) =>
      visit(page, url, ready, testInfo, `${name}-${colorScheme}`);

    // Signed out.
    const guest = await newPage(browser, baseURL!, colorScheme);
    await scan(guest, "/sign-in", h1("Sign in"), "sign-in");
    await scan(guest, "/sign-in/check-email", h1("Check your email"), "sign-in-check-email");
    await guest.context().close();

    // As admin.
    const page = await newPage(browser, baseURL!, colorScheme, "admin");
    await scan(page, "/admin", (p) => p.getByRole("link", { name: "Menu" }), "admin");
    await scan(page, "/admin/pages", (p) => p.getByRole("link", { name: "Admin a11y" }).first(), "pages");

    const form = page.getByRole("form", { name: "New page" });
    await form.getByLabel("Title").fill("Duplicate");
    await form.getByLabel("Slug").fill(slug);
    await form.getByRole("button", { name: "Create page" }).click();
    await expect(form.getByRole("alert")).toBeVisible();
    await expectNoViolations(new AxeBuilder({ page }), testInfo, `pages-create-error-${colorScheme}`);

    await scan(page, "/admin/news", (p) => p.getByText("Admin a11y post"), "news");
    await scan(page, "/admin/media", (p) => p.getByText("No alt text", { exact: true }).first(), "media");
    await scan(page, "/admin/users", h1("Users"), "users");
    await scan(page, "/admin/menu", (p) => p.getByRole("button", { name: "Add item" }), "menu");
    await scan(page, "/admin/settings", (p) => p.getByRole("button", { name: "Save brand" }), "settings");

    // A low-contrast color: refused, so nothing is saved.
    const brand = page.locator("#brand");
    await brand.getByLabel("Primary color, light mode").fill("#9ca3af");
    await brand.getByRole("button", { name: "Save brand" }).click();
    await expect(brand.getByRole("status")).toHaveText(/needs 4\.5:1/);
    // The color preview (the inline-styled sample) shows the refused color on purpose; the error text is scanned.
    await expectNoViolations(new AxeBuilder({ page }).exclude("#brand [style]"), testInfo, `settings-brand-error-${colorScheme}`);

    await brand.getByRole("button", { name: "Choose media" }).click();
    await expect(page.getByRole("dialog").getByRole("button", { name: filename })).toBeVisible();
    await expectNoViolations(new AxeBuilder({ page }), testInfo, `settings-logo-picker-${colorScheme}`);

    await scan(page, `/admin/pages/${pageId}/history`, h1(/^History/), "history");
    await scan(page, `/admin/pages/${pageId}/history/${revisionId}`, (p) => p.getByText(/^Revision of/), "revision");

    // The editor: only our parts (header actions, media picker), not Puck's own UI.
    const ours = () => new AxeBuilder({ page }).include("[data-fairspace]");
    await page.goto(`/admin/pages/${pageId}/edit`);
    await expect(page.getByRole("button", { name: "Save draft" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expectNoViolations(ours(), testInfo, `editor-${colorScheme}`);
    await page.getByRole("button", { name: "Choose media" }).click(); // the page's share image
    await expect(page.getByRole("dialog").getByRole("button", { name: filename })).toBeVisible();
    await expectNoViolations(ours(), testInfo, `editor-media-picker-${colorScheme}`);
    await page.context().close();

    // As editor: fewer links, and the forbidden page.
    const editor = await newPage(browser, baseURL!, colorScheme, "editor");
    await scan(editor, "/admin", (p) => p.getByRole("link", { name: "Media" }), "admin-as-editor");
    await scan(editor, "/admin/settings", h1("No access"), "forbidden");
    await editor.context().close();
  });
}
