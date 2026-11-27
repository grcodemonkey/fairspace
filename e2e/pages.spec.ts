import { type BrowserContext, expect, test } from "@playwright/test";
import postgres from "postgres";
import { allBlocksFixture } from "../src/puck/all-blocks.fixture";
import { signInAs } from "./helpers";

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const slug = `e2e-page-${crypto.randomUUID().slice(0, 8)}`;
const blocksSlug = `${slug}-blocks`;
const seoSlug = `${slug}-seo`;
const userIds: string[] = [];
// Smallest valid PNG (1×1, transparent).
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);
const signInAsEditor = async (context: BrowserContext, baseURL: string) =>
  userIds.push((await signInAs(sql, context, baseURL, "editor")).id);

test.afterAll(async () => {
  await sql`delete from pages where slug in ${sql([slug, blocksSlug, seoSlug])}`;
  if (userIds.length) await sql`delete from media where "uploadedBy" in ${sql(userIds)}`;
  if (userIds.length) await sql`delete from users where id in ${sql(userIds)}`; // the cascade removes the sessions
  await sql.end();
});

// The guard runs inside Suspense after the stream starts, so the status stays 200: assert the text.
test("editor-creates-and-saves-draft", async ({ page, context, baseURL }) => {
  await signInAsEditor(context, baseURL!);

  await page.goto("/admin");
  await page.getByRole("link", { name: "Pages" }).click();
  await expect(page.getByRole("heading", { name: "Pages" })).toBeVisible();

  const form = page.getByRole("form", { name: "New page" });
  await form.getByLabel("Title").fill("About us");
  await form.getByLabel("Slug").fill(slug);
  await form.getByRole("button", { name: "Create page" }).click();
  await expect(page).toHaveURL(/\/admin\/pages\/[\w-]+\/edit$/);

  const save = page.getByRole("button", { name: "Save draft" });
  await expect(save).toBeVisible();
  const title = page.getByRole("textbox", { name: "Title" });
  await expect(title).toHaveValue("About us");
  await title.fill("About our team");
  await save.click();
  // Puck's drag-and-drop adds its own status regions, so pick ours by its text.
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("textbox", { name: "Title" })).toHaveValue("About our team");
  const [row] = await sql`select "publishedRevisionId" from pages where slug = ${slug}`;
  expect(row.publishedRevisionId).toBeNull();
});

test("editor-seo-fields-save", async ({ page, context, baseURL }) => {
  await signInAsEditor(context, baseURL!);
  const [{ id }] = await sql`
    insert into pages (id, title, slug, draft)
    values (${crypto.randomUUID()}, 'SEO page', ${seoSlug}, ${sql.json({ root: { props: { title: "SEO page" } }, content: [] })})
    returning id`;
  await page.goto(`/admin/pages/${id}/edit`);
  const status = page.getByRole("status").filter({ hasText: /Saved|at most 300/ });

  await page.getByRole("textbox", { name: /^Description/ }).fill("Short summary");
  await page.getByRole("button", { name: "Choose media" }).click();
  await page.getByRole("dialog").getByLabel("Upload a file").setInputFiles({ name: "share.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByRole("button", { name: "Remove" })).toBeVisible(); // picked and the dialog closed
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(status).toHaveText("Saved");
  const [row] = await sql`select draft from pages where id = ${id}`;
  expect(row.draft.root.props).toMatchObject({ description: "Short summary", socialImage: expect.any(String) });

  await page.getByRole("textbox", { name: /^Description/ }).fill("x".repeat(301));
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(status).toHaveText("A Page text field can be at most 300 characters.");
});

test("editor-shows-all-blocks", async ({ page, context, baseURL }) => {
  await signInAsEditor(context, baseURL!);
  const draft = allBlocksFixture();
  const [{ id }] = await sql`
    insert into pages (id, title, slug, draft)
    values (${crypto.randomUUID()}, 'All blocks', ${blocksSlug}, ${sql.json(JSON.parse(JSON.stringify(draft)))})
    returning id`;

  // The frame-src CSP must not block Puck's own preview iframe.
  const response = await page.goto(`/admin/pages/${id}/edit`);
  expect(response?.headers()["content-security-policy"]).toContain("frame-src 'self'");
  const preview = page.frameLocator("iframe").first();
  await expect(preview.getByTitle("Our work in two minutes")).toHaveAttribute("src", /youtube-nocookie\.com\/embed\//);
  await expect(preview.getByRole("link", { name: "Give now" })).toHaveAttribute("href", /paypal\.com\/donate/);
  await expect(preview.getByRole("heading", { level: 1, name: "Welcome to Fairspace" })).toBeVisible();
  await expect(preview.getByRole("heading", { level: 3, name: "Support us" })).toBeVisible();
  await expect(preview.getByRole("link", { name: "Donate" })).toHaveAttribute("href", "/donate");
  await expect(preview.getByText("weekly events")).toBeVisible();
});

test("signed-out-redirected", async ({ page }) => {
  await page.goto("/admin/pages");
  await expect(page).toHaveURL(/\/sign-in$/);
});
