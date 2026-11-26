import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import postgres from "postgres";

// Full Chromium in new headless mode: the default headless shell has no PDF viewer and downloads PDFs.
test.use({ channel: "chromium" });

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const seeded: string[] = [];
const seededPages: string[] = [];

// Same as roles.spec.ts: a users row plus a sessions row is what a magic-link sign-in leaves behind.
async function signInAs(context: BrowserContext, baseURL: string, role: "admin" | "editor") {
  const id = crypto.randomUUID();
  const token = crypto.randomUUID();
  await sql`insert into users (id, email, role) values (${id}, ${`${role}-${id}@example.com`}, ${role})`;
  await sql`insert into sessions ("sessionToken", "userId", expires) values (${token}, ${id}, now() + interval '1 day')`;
  seeded.push(id);
  await context.addCookies([{ name: "authjs.session-token", value: token, url: baseURL }]);
  return id;
}

// Smallest valid PNG (1×1, transparent).
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

test.afterAll(async () => {
  if (seededPages.length) await sql`delete from pages where id = any(${seededPages})`;
  if (seeded.length) {
    await sql`delete from media where "uploadedBy" = any(${seeded})`;
    await sql`delete from users where id = any(${seeded})`;
  }
  await sql.end();
});

test("editor-uploads-image", async ({ page, context, baseURL }) => {
  await signInAs(context, baseURL!, "editor");
  await page.goto("/admin");
  await page.getByRole("link", { name: "Media" }).click();
  await expect(page.getByLabel("Upload a file")).toBeEnabled(); // enabled once hydrated
  await page.getByLabel("Upload a file").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByRole("status")).toHaveText("Uploaded logo.png");
});

test("svg-refused", async ({ page, context, baseURL }) => {
  await signInAs(context, baseURL!, "editor");
  await page.goto("/admin/media");
  await expect(page.getByLabel("Upload a file")).toBeEnabled(); // enabled once hydrated
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  await page.getByLabel("Upload a file").setInputFiles({ name: "logo.svg", mimeType: "image/svg+xml", buffer: svg });
  await expect(page.getByRole("status")).toHaveText(/Only JPEG, PNG, WebP, GIF, AVIF and PDF/);
});

test("renamed-file-refused", async ({ page, context, baseURL }) => {
  await signInAs(context, baseURL!, "editor");
  await page.goto("/admin/media");
  await expect(page.getByLabel("Upload a file")).toBeEnabled(); // enabled once hydrated
  const html = Buffer.from("<html><script>alert(1)</script></html>");
  await page.getByLabel("Upload a file").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: html });
  await expect(page.getByRole("status")).toHaveText("The file content does not match its type.");
});

test("signed-out-redirected", async ({ page }) => {
  await page.goto("/admin/media");
  await expect(page).toHaveURL(/\/sign-in$/);
});

const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj " +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
);

const unique = (ext: string) => `${crypto.randomUUID().slice(0, 8)}.${ext}`;

/** Uploads on /admin/media and returns the new library row and the file's public URL. */
async function upload(page: Page, name: string, mimeType = "image/png", buffer = PNG) {
  await page.goto("/admin/media");
  await expect(page.getByLabel("Upload a file")).toBeEnabled(); // enabled once hydrated
  await page.getByLabel("Upload a file").setInputFiles({ name, mimeType, buffer });
  await expect(page.getByRole("status")).toHaveText(`Uploaded ${name}`);
  const row = page.getByRole("listitem").filter({ hasText: name });
  await expect(row).toBeVisible(); // no reload: finishUpload refreshes the page
  const url = (await row.getByRole("link", { name }).getAttribute("href"))!;
  return { row, url, id: url.slice("/media/".length).split(".")[0] };
}

test("library-shows-upload", async ({ page, context, baseURL }) => {
  await signInAs(context, baseURL!, "editor");
  const { row } = await upload(page, unique("png"));
  await expect(row.getByText(/image\/png · 1 KB · uploaded \d{4}-\d{2}-\d{2}/)).toBeVisible();
  await expect(row.getByText("No alt text")).toBeVisible();
});

test("alt-edit", async ({ page, context, baseURL }) => {
  await signInAs(context, baseURL!, "editor");
  const { row } = await upload(page, unique("png"));
  await row.getByLabel("Alt text").fill("A red bike");
  await row.getByRole("button", { name: "Save" }).click();
  await expect(row.getByText("No alt text")).toHaveCount(0);
  await page.reload();
  await expect(row.getByLabel("Alt text")).toHaveValue("A red bike");
});

test("delete-own", async ({ page, context, baseURL, request }) => {
  await signInAs(context, baseURL!, "editor");
  const name = unique("png");
  const { row, url } = await upload(page, name);
  page.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: name })).toHaveCount(0);
  expect((await request.get(url)).status()).toBe(404);
});

test("editor-cannot-delete-others", async ({ page, context, baseURL }) => {
  const other = crypto.randomUUID();
  await sql`insert into users (id, email, role) values (${other}, ${`editor-${other}@example.com`}, 'editor')`;
  seeded.push(other);
  const name = unique("png");
  await sql`insert into media (id, key, filename, "contentType", size, "uploadedBy", "uploadedAt")
            values (${other}, ${`media/${other}.png`}, ${name}, 'image/png', 70, ${other}, now())`;
  await signInAs(context, baseURL!, "editor");
  await page.goto("/admin/media");
  const row = page.getByRole("listitem").filter({ hasText: name });
  await expect(row).toBeVisible();
  await expect(row.getByRole("button", { name: "Delete" })).toHaveCount(0);
  await expect(row.getByLabel("Alt text")).toBeVisible(); // a shared library: anyone may edit alt text
});

test("delete-in-use-refused", async ({ page, context, baseURL }) => {
  await signInAs(context, baseURL!, "editor");
  const { row, id } = await upload(page, unique("png"));
  const pageId = crypto.randomUUID();
  const draft = { content: [{ type: "Image", props: { id: "b1", media: id } }], root: { props: {} } };
  await sql`insert into pages (id, slug, title, draft) values (${pageId}, ${`t-${pageId}`}, 'About us', ${sql.json(draft)})`;
  seededPages.push(pageId);
  page.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "Delete" }).click();
  await expect(row.getByText("Used on: About us. Remove it from these pages first.")).toBeVisible();
  await page.reload();
  await expect(row).toBeVisible();
});

test("served-file-headers", async ({ page, context, baseURL, playwright }) => {
  const userId = await signInAs(context, baseURL!, "editor");
  const { url } = await upload(page, unique("png"));
  const pending = crypto.randomUUID();
  await sql`insert into media (id, key, filename, "contentType", size, "uploadedBy")
            values (${pending}, ${`uploads/${pending}`}, 'p.png', 'image/png', 70, ${userId})`;

  const anonymous = await playwright.request.newContext({ baseURL }); // signed out: no cookies
  const res = await anonymous.get(url);
  const headers = res.headers();
  const pendingStatus = (await anonymous.get(`/media/${pending}.png`)).status();
  await anonymous.dispose();
  console.log(`GET ${url} -> ${res.status()}`);
  for (const name of ["content-type", "x-content-type-options", "cache-control", "content-disposition", "content-security-policy"]) {
    console.log(`  ${name}: ${headers[name]}`);
  }
  console.log(`GET /media/<pending-id>.png -> ${pendingStatus}`);
  expect(res.status()).toBe(200);
  expect(headers["content-type"]).toBe("image/png");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["cache-control"]).toBe("public, max-age=86400");
  expect(headers["content-disposition"]).toMatch(/^inline; filename\*=UTF-8''/);
  expect(pendingStatus).toBe(404);
});

test("pdf-inline-renders", async ({ page, context, baseURL }) => {
  await signInAs(context, baseURL!, "editor");
  const { url } = await upload(page, unique("pdf"), "application/pdf", PDF);
  const res = await page.goto(url); // a download instead of the viewer would throw here
  expect(res?.headers()["content-type"]).toBe("application/pdf");
  // Chrome's PDF viewer runs as an extension frame inside the page.
  await expect.poll(() => page.frames().some((f) => f.url().startsWith("chrome-extension://"))).toBe(true);
});
