import { type BrowserContext, expect, test } from "@playwright/test";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const seeded: string[] = [];

// Same as roles.spec.ts: a users row plus a sessions row is what a magic-link sign-in leaves behind.
async function signInAs(context: BrowserContext, baseURL: string, role: "admin" | "editor") {
  const id = crypto.randomUUID();
  const token = crypto.randomUUID();
  await sql`insert into users (id, email, role) values (${id}, ${`${role}-${id}@example.com`}, ${role})`;
  await sql`insert into sessions ("sessionToken", "userId", expires) values (${token}, ${id}, now() + interval '1 day')`;
  seeded.push(id);
  await context.addCookies([{ name: "authjs.session-token", value: token, url: baseURL }]);
}

// Smallest valid PNG (1×1, transparent).
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

test.afterAll(async () => {
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
  await expect(page.getByRole("heading", { name: "Media" })).toBeVisible();
  await page.getByLabel("Upload a file").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByRole("status")).toHaveText("Uploaded logo.png");
});

test("svg-refused", async ({ page, context, baseURL }) => {
  await signInAs(context, baseURL!, "editor");
  // networkidle: a file picked before hydration has no onChange handler yet.
  await page.goto("/admin/media", { waitUntil: "networkidle" });
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  await page.getByLabel("Upload a file").setInputFiles({ name: "logo.svg", mimeType: "image/svg+xml", buffer: svg });
  await expect(page.getByRole("status")).toHaveText(/Only JPEG, PNG, WebP, GIF, AVIF and PDF/);
});

test("renamed-file-refused", async ({ page, context, baseURL }) => {
  await signInAs(context, baseURL!, "editor");
  // networkidle: a file picked before hydration has no onChange handler yet.
  await page.goto("/admin/media", { waitUntil: "networkidle" });
  const html = Buffer.from("<html><script>alert(1)</script></html>");
  await page.getByLabel("Upload a file").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: html });
  await expect(page.getByRole("status")).toHaveText("The file content does not match its type.");
});

test("signed-out-redirected", async ({ page }) => {
  await page.goto("/admin/media");
  await expect(page).toHaveURL(/\/sign-in$/);
});
