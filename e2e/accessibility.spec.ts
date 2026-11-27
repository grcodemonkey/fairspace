import AxeBuilder from "@axe-core/playwright";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { type Browser, expect, type Page, test, type TestInfo } from "@playwright/test";
import postgres from "postgres";
import { allBlocksFixture, FIXTURE_MEDIA_ID } from "../src/puck/all-blocks.fixture";
import { signInAs } from "./helpers";

// #17: axe (WCAG 2.2 AA) on a page with every block and on the welcome page, light and dark, desktop and mobile,
// menu closed and open. The menu is site-wide: it is saved and emptied through /admin/menu, so the cache tag expires.
test.describe.configure({ mode: "serial" });

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  forcePathStyle: true,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
});
const run = crypto.randomUUID().slice(0, 8);
const slug = `e2e-a11y-${run}`;
const mediaKey = `media/${FIXTURE_MEDIA_ID}.png`;
const userIds: string[] = [];
// A 16×16 red PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGO4IydHEmIY1TCqYfhqAACaMxgQdGu1YAAAAABJRU5ErkJggg==",
  "base64",
);
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const modes = [
  { colorScheme: "light", width: "desktop", viewport: { width: 1440, height: 900 } },
  { colorScheme: "dark", width: "desktop", viewport: { width: 1440, height: 900 } },
  { colorScheme: "light", width: "mobile", viewport: { width: 390, height: 844 } },
  { colorScheme: "dark", width: "mobile", viewport: { width: 390, height: 844 } },
] as const;

/** Opens /admin/menu as a new admin, with every saved item removed (not saved yet). */
async function emptyMenuForm(browser: Browser, baseURL: string): Promise<Page> {
  const context = await browser.newContext();
  userIds.push((await signInAs(sql, context, baseURL, "admin")).id);
  const page = await context.newPage();
  await page.goto("/admin/menu");
  await expect(page.getByRole("button", { name: "Add item" })).toBeVisible(); // the form and its saved items are there
  const remove = page.getByRole("button", { name: /^Remove Item \d+$/ });
  while ((await remove.count()) > 0) await remove.first().click();
  return page;
}

test.beforeAll(async ({ browser, baseURL }) => {
  // A crashed earlier run can leave the fixture media row.
  await sql`delete from media where id = ${FIXTURE_MEDIA_ID}`;
  await s3.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: mediaKey, Body: PNG, ContentType: "image/png" }));
  await sql`insert into media (id, key, filename, "contentType", size, "uploadedAt", alt)
    values (${FIXTURE_MEDIA_ID}, ${mediaKey}, ${`a11y-${run}.png`}, 'image/png', ${PNG.length}, now(), 'A red bike')`;

  const data = allBlocksFixture();
  // The fixture's Hero has no background; this one scans the overlay path too.
  data.content.push({
    type: "Hero",
    props: { id: "hero-2", title: "Join us", level: "h2", subtitle: "Every Saturday.", buttonLabel: "", buttonHref: "", image: FIXTURE_MEDIA_ID },
  });
  const [page] = await sql`insert into pages (id, title, slug, draft)
    values (${crypto.randomUUID()}, 'All blocks', ${slug}, ${sql.json(data)}) returning id`;
  const [rev] = await sql`insert into page_revisions (id, "pageId", data)
    values (${crypto.randomUUID()}, ${page.id}, ${sql.json(data)}) returning id`;
  await sql`update pages set "publishedRevisionId" = ${rev.id} where id = ${page.id}`;

  // Two URL items; the second has one child: this page, so the "current child" state is scanned too.
  const admin = await emptyMenuForm(browser, baseURL!);
  const item = (name: string) => admin.getByRole("group", { name, exact: true });
  for (let i = 0; i < 2; i++) await admin.getByRole("button", { name: "Add item" }).click();
  for (const [name, label, url] of [
    ["Item 1", "Home", "/"],
    ["Item 2", "Programs", "https://example.org/programs"],
  ]) {
    await item(name).getByLabel("Label").first().fill(label);
    await item(name).getByLabel("Link to").first().selectOption("url");
    await item(name).getByLabel("URL").first().fill(url);
  }
  await item("Item 2").getByRole("button", { name: "Add child Item 2" }).click();
  await item("Item 2.1").getByLabel("Label").fill("All blocks");
  await item("Item 2.1").getByLabel("Link to").selectOption("url");
  await item("Item 2.1").getByLabel("URL").fill(`/${slug}`);
  await admin.getByRole("button", { name: "Save menu" }).click();
  await expect(admin.getByRole("status")).toHaveText("Saved");
  await admin.context().close();
});

test.afterAll(async ({ browser, baseURL }) => {
  // Empty the menu through the save action: it expires the cached menu that menu.spec.ts expects to be gone.
  const admin = await emptyMenuForm(browser, baseURL!);
  await admin.getByRole("button", { name: "Save menu" }).click();
  await expect(admin.getByRole("status")).toHaveText("Saved");
  await admin.context().close();

  await sql`delete from pages where slug = ${slug}`; // cascades to page_revisions
  await sql`delete from media where id = ${FIXTURE_MEDIA_ID}`;
  if (userIds.length) await sql`delete from users where id in ${sql(userIds)}`; // and to the sessions
  await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: mediaKey }));
  await sql.end();
});

/** Runs axe and fails with one readable line per violation; the full JSON goes in the HTML report. */
async function expectNoViolations(page: Page, testInfo: TestInfo, name: string) {
  // Third-party frames (YouTube, Google Forms) are not ours; embed-frame-titles checks their titles instead.
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).exclude("main iframe").analyze();
  await testInfo.attach(`axe-${name}.json`, { body: JSON.stringify(violations, null, 2), contentType: "application/json" });
  const report = violations
    .map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} nodes: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(", ")}\n  ${v.helpUrl}`)
    .join("\n");
  // Soft: every scan in the test runs, so one CI run lists every rule that fails.
  expect.soft(violations.map((v) => v.id), `axe ${name}:\n${report}`).toEqual([]);
}

async function open(page: Page, mobile: boolean) {
  const nav = page.getByRole("navigation", { name: "Main" });
  if (mobile) await nav.locator("summary", { hasText: "Menu" }).click();
  const toggle = nav.locator("li details"); // the one dropdown: Programs
  if (!(await toggle.evaluate((el: HTMLDetailsElement) => el.open))) await toggle.locator("summary").click();
  await expect(nav.getByRole("link", { name: "All blocks" })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  // No third-party traffic: the embeds load nothing, and the scan does not depend on the network.
  await page.route(/^(?!http:\/\/localhost:3000\/)/, (route) => route.abort());
});

for (const { colorScheme, width, viewport } of modes) {
  test(`axe-all-blocks-${colorScheme}-${width}`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme });
    await page.setViewportSize(viewport);
    await page.goto(`/${slug}`);
    await expect(page.locator('main img[alt="A red bike"]').first()).toBeVisible();
    await expectNoViolations(page, testInfo, `all-blocks-${colorScheme}-${width}-menu-closed`);
    await open(page, width === "mobile");
    await expectNoViolations(page, testInfo, `all-blocks-${colorScheme}-${width}-menu-open`);
  });

  test(`axe-welcome-${colorScheme}-${width}`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme });
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expectNoViolations(page, testInfo, `welcome-${colorScheme}-${width}`);
  });
}

test("embed-frame-titles", async ({ page }) => {
  await page.goto(`/${slug}`);
  const frames = page.locator("main iframe");
  await expect(frames).toHaveCount(2);
  await expect(frames.nth(0)).toHaveAttribute("title", "Our work in two minutes");
  await expect(frames.nth(1)).toHaveAttribute("title", "Volunteer sign-up form");
});

test("single-h1-on-fixture", async ({ page }) => {
  await page.goto(`/${slug}`);
  await expect(page.locator("main h1")).toHaveCount(1);
});
