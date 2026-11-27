import { expect, test } from "@playwright/test";
import postgres from "postgres";

// All tests run signed out: public pages need no session.
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const run = crypto.randomUUID().slice(0, 8);
const published = `e2e-pub-${run}`;
const draftOnly = `e2e-draft-${run}`;
const seoSlug = `e2e-seo-${run}`;
const seoUnknownSlug = `e2e-seo-unknown-${run}`;
const mediaId = crypto.randomUUID();
const doc = (title: string, props: object = {}) => ({ root: { props: { title, ...props } }, content: [] });

test.beforeAll(async () => {
  for (const slug of [published, draftOnly]) {
    await sql`insert into pages (id, title, slug, draft)
      values (${crypto.randomUUID()}, ${"Draft title " + run}, ${slug}, ${sql.json(doc("Draft title " + run))})`;
  }
  // Publish by hand until #12 adds a publish action.
  const [rev] = await sql`insert into page_revisions (id, "pageId", data)
    select ${crypto.randomUUID()}, id, ${sql.json(doc("Published title " + run))} from pages where slug = ${published}
    returning id`;
  await sql`update pages set "publishedRevisionId" = ${rev.id} where slug = ${published}`;

  // A finished image row is enough for meta tags: no S3 object is read.
  await sql`insert into media (id, key, filename, "contentType", size, "uploadedAt", alt)
    values (${mediaId}, ${`media/${mediaId}.png`}, 'share.png', 'image/png', 70, now(), 'A test image')`;
  const seoPages = [
    [seoSlug, { description: "A short summary", socialImage: mediaId, noindex: true }],
    [seoUnknownSlug, { socialImage: crypto.randomUUID() }],
  ] as const;
  for (const [slug, props] of seoPages) {
    await sql`insert into pages (id, title, slug, draft)
      values (${crypto.randomUUID()}, 'SEO', ${slug}, ${sql.json(doc("SEO", props))})`;
    const [seoRev] = await sql`insert into page_revisions (id, "pageId", data)
      select ${crypto.randomUUID()}, id, ${sql.json(doc("SEO " + run, props))} from pages where slug = ${slug} returning id`;
    await sql`update pages set "publishedRevisionId" = ${seoRev.id} where slug = ${slug}`;
  }
});

test.afterAll(async () => {
  await sql`delete from pages where slug in (${published}, ${draftOnly}, ${seoSlug}, ${seoUnknownSlug})`; // cascades to page_revisions
  await sql`delete from media where id = ${mediaId}`;
  await sql.end();
});

test("published-page-renders", async ({ page }) => {
  const response = await page.goto(`/${published}`);
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(`Published title ${run}`);
  await expect(page.getByText(`Draft title ${run}`)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Fairspace" })).toBeVisible();
});

test("draft-only-page-404", async ({ page }) => {
  const response = await page.goto(`/${draftOnly}`);
  expect(response?.status()).toBe(404);
});

test("unknown-slug-404", async ({ page }) => {
  expect((await page.goto(`/no-such-page-${run}`))?.status()).toBe(404);
  expect((await page.goto(`/a/b-${run}`))?.status()).toBe(404);
});

test("home-redirect", async ({ page }) => {
  const response = await page.goto("/home");
  expect(response?.request().redirectedFrom()?.url()).toMatch(/\/home$/);
  await expect(page).toHaveURL("/");
});

test("seo-tags-render", async ({ page, baseURL }) => {
  expect((await page.goto(`/${seoSlug}`))?.status()).toBe(200);
  const meta = (selector: string) => page.locator(`head ${selector}`);
  await expect(meta('meta[name="description"]')).toHaveAttribute("content", "A short summary");
  await expect(meta('link[rel="canonical"]')).toHaveAttribute("href", `${baseURL}/${seoSlug}`);
  await expect(meta('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(meta('meta[property="og:image"]')).toHaveAttribute("content", `${baseURL}/media/${mediaId}.png`);
  await expect(meta('meta[property="og:image:alt"]')).toHaveAttribute("content", "A test image");
  await expect(meta('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
});

test("seo-unknown-media-no-image", async ({ page }) => {
  expect((await page.goto(`/${seoUnknownSlug}`))?.status()).toBe(200);
  await expect(page.locator('head meta[property="og:image"]')).toHaveCount(0);
});
