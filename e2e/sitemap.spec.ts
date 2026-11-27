import { type APIRequestContext, expect, test } from "@playwright/test";
import postgres from "postgres";
import { signInAs } from "./helpers";

test.describe.configure({ mode: "serial" });

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const slug = `e2e-sitemap-${crypto.randomUUID().slice(0, 8)}`;
let userId = "";

test.afterAll(async () => {
  await sql`delete from pages where slug = ${slug}`;
  if (userId) await sql`delete from users where id = ${userId}`;
  await sql.end();
});

const sitemap = async (request: APIRequestContext) => (await request.get("/sitemap.xml")).text();

test("robots-points-to-sitemap", async ({ request }) => {
  const text = await (await request.get("/robots.txt")).text();
  expect(text).toContain("Disallow: /admin");
  expect(text).toContain("Sitemap: http://localhost:3000/sitemap.xml");
});

test("publish-and-unpublish-update-sitemap", async ({ browser, request, baseURL }) => {
  const context = await browser.newContext();
  userId = (await signInAs(sql, context, baseURL!, "editor")).id;
  const page = await context.newPage();
  expect(await sitemap(request)).not.toContain(`/${slug}<`); // also warms the cached entry list
  await page.goto("/admin/pages");
  const form = page.getByRole("form", { name: "New page" });
  await form.getByLabel("Title").fill("Sitemap test");
  await form.getByLabel("Slug").fill(slug);
  await form.getByRole("button", { name: "Create page" }).click();
  await expect(page).toHaveURL(/\/admin\/pages\/[\w-]+\/edit$/);
  const editUrl = page.url();
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByRole("status").filter({ hasText: /^Published$/ })).toBeVisible();
  expect(await sitemap(request)).toContain(`http://localhost:3000/${slug}<`);

  await page.goto(editUrl.replace(/\/edit$/, "/history"));
  await page.getByRole("button", { name: "Unpublish" }).click();
  await expect.poll(() => sitemap(request)).not.toContain(`/${slug}<`);
});
