import { expect, test } from "@playwright/test";
import postgres from "postgres";

// All tests run signed out: public pages need no session.
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const run = crypto.randomUUID().slice(0, 8);
const published = `e2e-pub-${run}`;
const draftOnly = `e2e-draft-${run}`;
const doc = (title: string) => ({ root: { props: { title } }, content: [] });

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
});

test.afterAll(async () => {
  await sql`delete from pages where slug in (${published}, ${draftOnly})`; // cascades to page_revisions
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
