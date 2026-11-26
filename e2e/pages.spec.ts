import { expect, test } from "@playwright/test";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const run = crypto.randomUUID().slice(0, 8);
const userId = `pages-editor-${run}`;
const slug = `e2e-page-${run}`;

test.afterAll(async () => {
  await sql`delete from pages where slug = ${slug}`;
  await sql`delete from users where id = ${userId}`; // the cascade removes the session
  await sql.end();
});

// The guard runs inside Suspense after the stream starts, so the status stays 200: assert the text.
test("editor-creates-and-saves-draft", async ({ page, context, baseURL }) => {
  // Skips Mailpit, as in roles.spec.ts: a users row plus a sessions row is a signed-in editor.
  const token = crypto.randomUUID();
  await sql`insert into users (id, email, role) values (${userId}, ${`${userId}@example.com`}, 'editor')`;
  await sql`insert into sessions ("sessionToken", "userId", expires) values (${token}, ${userId}, now() + interval '1 day')`;
  await context.addCookies([{ name: "authjs.session-token", value: token, url: baseURL! }]);

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
  await expect(page.getByRole("status")).toHaveText("Saved");

  await page.reload();
  await expect(page.getByRole("textbox", { name: "Title" })).toHaveValue("About our team");
  const [row] = await sql`select "publishedRevisionId" from pages where slug = ${slug}`;
  expect(row.publishedRevisionId).toBeNull();
});

test("signed-out-redirected", async ({ page }) => {
  await page.goto("/admin/pages");
  await expect(page).toHaveURL(/\/sign-in$/);
});
