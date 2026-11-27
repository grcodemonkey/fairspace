import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { signInAs } from "./helpers";

// #14: Image, Image + text and Card grid in the editor and on the public page.
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  forcePathStyle: true,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
});
const run = crypto.randomUUID().slice(0, 8);
const mediaId = crypto.randomUUID();
const filename = `bike-${run}.png`;
const blocksSlug = `e2e-media-${run}`;
const unknownSlug = `e2e-media-unknown-${run}`;
const editorSlug = `e2e-media-editor-${run}`;
const userIds: string[] = [];
// A 16×16 red PNG: big enough for the optimizer to resize.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGO4IydHEmIY1TCqYfhqAACaMxgQdGu1YAAAAABJRU5ErkJggg==",
  "base64",
);

const doc = (content: unknown[]) => ({ root: { props: { title: "Media " + run } }, content });
const blocks = (image: string) => [
  { type: "Image", props: { id: "Image-1", image, caption: "Bike day" } },
  {
    type: "ImageText",
    props: {
      id: "ImageText-1",
      image,
      imageSide: "left",
      content: [{ type: "Heading", props: { id: "Heading-1", text: "Garden", level: "h2", align: "left" } }],
    },
  },
  { type: "CardGrid", props: { id: "CardGrid-1", cards: [{ image, title: "Market", text: "Saturdays", href: "/market" }] } },
];

async function publish(slug: string, data: object) {
  const [page] = await sql`insert into pages (id, title, slug, draft)
    values (${crypto.randomUUID()}, 'Media', ${slug}, ${sql.json(data)}) returning id`;
  const [rev] = await sql`insert into page_revisions (id, "pageId", data)
    values (${crypto.randomUUID()}, ${page.id}, ${sql.json(data)}) returning id`;
  await sql`update pages set "publishedRevisionId" = ${rev.id} where id = ${page.id}`;
  return page.id as string;
}

test.beforeAll(async () => {
  await s3.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: `media/${mediaId}.png`, Body: PNG, ContentType: "image/png" }));
  await sql`insert into media (id, key, filename, "contentType", size, "uploadedAt", alt)
    values (${mediaId}, ${`media/${mediaId}.png`}, ${filename}, 'image/png', ${PNG.length}, now(), 'A red bike')`;
  await publish(blocksSlug, doc(blocks(mediaId)));
  await publish(unknownSlug, doc(blocks(crypto.randomUUID())));
});

test.afterAll(async () => {
  await sql`delete from pages where slug in ${sql([blocksSlug, unknownSlug, editorSlug])}`; // cascades to page_revisions
  await sql`delete from media where id = ${mediaId}`;
  if (userIds.length) await sql`delete from media where "uploadedBy" in ${sql(userIds)}`;
  if (userIds.length) await sql`delete from users where id in ${sql(userIds)}`;
  await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: `media/${mediaId}.png` }));
  await sql.end();
});

test("media-blocks-render", async ({ page }) => {
  expect((await page.goto(`/${blocksSlug}`))?.status()).toBe(200);
  const images = page.locator('main img[alt="A red bike"]');
  await expect(images).toHaveCount(3);
  for (const img of await images.all()) {
    await expect(img).toHaveAttribute("srcset", /\/_next\/image\?url=%2Fmedia%2F/);
    await img.scrollIntoViewIfNeeded(); // lazy loading
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  }
  await expect(page.locator("main figcaption")).toHaveText("Bike day");
  await expect(page.getByRole("heading", { level: 3 }).getByRole("link", { name: "Market" })).toHaveAttribute("href", "/market");
});

test("media-unknown-id-no-image", async ({ page }) => {
  expect((await page.goto(`/${unknownSlug}`))?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Garden" })).toBeVisible();
  await expect(page.locator("main img")).toHaveCount(0);
  await expect(page.getByText(/deleted|Choose an image/)).toHaveCount(0);
});

test("media-alt-edit-shows", async ({ page, context, baseURL }) => {
  await page.goto(`/${blocksSlug}`); // fill the cache first, so the test proves the tag refresh
  await expect(page.locator('main img[alt="A red bike"]')).toHaveCount(3);
  userIds.push((await signInAs(sql, context, baseURL!, "editor")).id);
  await page.goto("/admin/media");
  const row = page.getByRole("listitem").filter({ hasText: filename });
  await row.getByLabel("Alt text").fill("A blue bike");
  await row.getByRole("button", { name: "Save" }).click();
  await expect(row.getByRole("button", { name: "Save" })).toBeEnabled();
  await expect.poll(async () => {
    await page.goto(`/${blocksSlug}`);
    return page.locator('main img[alt="A blue bike"]').count();
  }).toBe(3);
});

test("media-blocks-editor", async ({ page, context, baseURL }) => {
  userIds.push((await signInAs(sql, context, baseURL!, "editor")).id);
  const draft = doc([
    { type: "Image", props: { id: "Image-1", image: null, caption: "" } },
    { type: "CardGrid", props: { id: "CardGrid-1", cards: [{ image: null, title: "Volunteer", text: "", href: "" }] } },
  ]);
  const [{ id }] = await sql`insert into pages (id, title, slug, draft)
    values (${crypto.randomUUID()}, 'Media editor', ${editorSlug}, ${sql.json(draft)}) returning id`;
  await page.goto(`/admin/pages/${id}/edit`);
  const preview = page.frameLocator("iframe").first();

  // Image block: pick by upload; the preview shows the image before any save.
  await preview.getByText("Choose an image").first().click();
  await page.getByRole("button", { name: "Choose media" }).click();
  await page.getByRole("dialog").getByLabel("Upload a file").setInputFiles({ name: `pick-${run}.png`, mimeType: "image/png", buffer: PNG });
  await expect(page.getByRole("button", { name: "Remove" })).toBeVisible();
  await expect(preview.locator("figure img")).toBeVisible();
  // A new upload has no alt text yet.
  await expect(preview.getByText("No alt text. Add it in the media library.")).toBeVisible();

  // Card grid: the media field renders inside an array item.
  await preview.getByRole("heading", { name: "Volunteer" }).click();
  await page.getByRole("button", { name: "Volunteer" }).click(); // open the card
  await page.getByRole("button", { name: "Choose media" }).click();
  await page.getByRole("dialog").getByRole("button", { name: `pick-${run}.png` }).first().click();
  await expect(preview.locator("article img")).toBeVisible();

  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();
  const [row] = await sql`select draft from pages where id = ${id}`;
  expect(row.draft.content[0].props.image).toMatch(/^[0-9a-f-]{36}$/);
  expect(row.draft.content[1].props.cards[0].image).toBe(row.draft.content[0].props.image);
});
