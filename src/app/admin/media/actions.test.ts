// @vitest-environment node
// Integration: real test database and the SeaweedFS test bucket (pnpm db:up).
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { getDb } from "@/db";
import { media, pageRevisions, pages, users } from "@/db/schema";
import { requireUser } from "@/guards";
import { ALT_MAX, MAX_BYTES } from "@/media";
import { listMedia, sweepPendingUploads } from "@/media-library";
import { getStorage } from "@/storage";
import { createUpload, deleteMediaAction, finishUpload, listMediaAction, updateAltAction } from "./actions";

vi.mock("@/guards", () => ({ requireUser: vi.fn() }));
// Both need a request scope; the sweeper is tested directly below.
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

const alice = { id: crypto.randomUUID(), email: `alice-${crypto.randomUUID()}@example.com`, role: "editor" as const };
const bob = { id: crypto.randomUUID(), email: `bob-${crypto.randomUUID()}@example.com`, role: "editor" as const };
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52]);

// No users row: users.test.ts counts admins, and this one only needs to pass the mocked guard.
const admin = { id: crypto.randomUUID(), email: "admin@example.com", role: "admin" as const };
const pageIds: string[] = [];

const signedInAs = (user: typeof alice | typeof admin) => vi.mocked(requireUser).mockResolvedValue(user);
const put = (url: string, body: Uint8Array<ArrayBuffer> | string, type = "image/png") =>
  fetch(url, { method: "PUT", headers: { "Content-Type": type }, body });
const rowOf = async (id: string) => (await getDb().select().from(media).where(eq(media.id, id)))[0];
const objectExists = async (key: string) => {
  const { client, bucket } = getStorage();
  return client.send(new HeadObjectCommand({ Bucket: bucket, Key: key })).then(
    () => true,
    () => false,
  );
};

beforeAll(async () => {
  await getDb().insert(users).values([alice, bob]);
});
beforeEach(() => {
  signedInAs(alice); // braces: a returned function would run as teardown
});
afterAll(async () => {
  if (pageIds.length) await getDb().delete(pages).where(inArray(pages.id, pageIds));
  await getDb().delete(media).where(inArray(media.uploadedBy, [alice.id, bob.id]));
  await getDb().delete(users).where(inArray(users.id, [alice.id, bob.id]));
});

/** A finished PNG upload by the signed-in user. */
async function uploaded() {
  const result = await createUpload({ filename: "photo.png", type: "image/png", size: PNG.length });
  if (!result.ok) throw new Error(result.error);
  await put(result.url, PNG);
  const finished = await finishUpload(result.id);
  if (!finished.ok) throw new Error(finished.error);
  return result.id;
}

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

test("presign-scoped-key", async () => {
  const result = await createUpload({ filename: "../../etc/passwd.png", type: "image/png", size: PNG.length });
  if (!result.ok) throw new Error(result.error);
  const url = new URL(result.url);
  const row = await rowOf(result.id);
  expect(row.key).toBe(`uploads/${result.id}`); // the server picks the staging key, not the filename
  expect(url.pathname).toBe(`/${process.env.S3_BUCKET}/${row.key}`);
  expect(Number(url.searchParams.get("X-Amz-Expires"))).toBeLessThanOrEqual(300);
  expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("content-length;content-type;host");
  expect(row.uploadedAt).toBeNull();

  expect((await put(result.url, PNG)).status).toBe(200);
  expect(await finishUpload(result.id)).toEqual({ ok: true, filename: "../../etc/passwd.png" });
  const done = await rowOf(result.id);
  expect(done.key).toBe(`media/${result.id}.png`);
  expect(done.uploadedAt).toBeInstanceOf(Date);
  expect(await objectExists(done.key)).toBe(true);
  expect(await objectExists(`uploads/${result.id}`)).toBe(false);
  // A finished upload cannot be finished again.
  expect(await finishUpload(result.id)).toMatchObject({ ok: false });
});

test("overwrite-after-finish", async () => {
  const result = await createUpload({ filename: "a.png", type: "image/png", size: PNG.length });
  if (!result.ok) throw new Error(result.error);
  await put(result.url, PNG);
  expect(await finishUpload(result.id)).toMatchObject({ ok: true });

  // The URL is still valid, but it only writes the staging key; the checked object in media/ stays the same.
  const evil = new Uint8Array(PNG.length).fill(0x3c);
  await put(result.url, evil);
  const { client, bucket } = getStorage();
  const final = await client.send(new GetObjectCommand({ Bucket: bucket, Key: `media/${result.id}.png` }));
  expect(await final.Body!.transformToByteArray()).toEqual(PNG);
});

test("bucket-refuses-other-body", async () => {
  const result = await createUpload({ filename: "a.png", type: "image/png", size: PNG.length });
  if (!result.ok) throw new Error(result.error);
  // The signed Content-Length and Content-Type make the bucket refuse a bigger body or another type.
  expect((await put(result.url, new Uint8Array(PNG.length + 100))).status).toBe(403);
  expect((await put(result.url, PNG, "text/html")).status).toBe(403);
  expect(await finishUpload(result.id)).toMatchObject({ ok: false });
  expect(await rowOf(result.id)).toBeUndefined();
});

test("finish-rejects-mismatch", async () => {
  const html = "<html><script>x</script>"; // declared as PNG, but the bytes are not
  const result = await createUpload({ filename: "fake.png", type: "image/png", size: html.length });
  if (!result.ok) throw new Error(result.error);
  expect((await put(result.url, html)).status).toBe(200);
  const key = (await rowOf(result.id)).key;
  expect(await objectExists(key)).toBe(true);

  expect(await finishUpload(result.id)).toEqual({ ok: false, error: "The file content does not match its type." });
  expect(await objectExists(key)).toBe(false);
  expect(await rowOf(result.id)).toBeUndefined();
});

test("finish-rejects-other-user", async () => {
  const result = await createUpload({ filename: "a.png", type: "image/png", size: PNG.length });
  if (!result.ok) throw new Error(result.error);
  await put(result.url, PNG);
  signedInAs(bob);
  expect(await finishUpload(result.id)).toEqual({ ok: false, error: "Upload not found." });
  expect((await rowOf(result.id)).uploadedAt).toBeNull(); // untouched
});

test("oversize-refused-at-create", async () => {
  expect(await createUpload({ filename: "big.png", type: "image/png", size: MAX_BYTES + 1 })).toMatchObject({
    ok: false,
  });
  expect(await createUpload({ filename: "x.svg", type: "image/svg+xml", size: 10 })).toMatchObject({ ok: false });
});

test("actions-call-guard", async () => {
  vi.mocked(requireUser).mockRejectedValue(new Error("NEXT_REDIRECT"));
  await expect(createUpload({ filename: "a.png", type: "image/png", size: 1 })).rejects.toThrow("NEXT_REDIRECT");
  await expect(finishUpload("x")).rejects.toThrow("NEXT_REDIRECT");
  await expect(updateAltAction({}, form({ id: "x", alt: "a" }))).rejects.toThrow("NEXT_REDIRECT");
  await expect(deleteMediaAction({}, form({ id: "x" }))).rejects.toThrow("NEXT_REDIRECT");
  await expect(listMediaAction()).rejects.toThrow("NEXT_REDIRECT");
});

test("list-hides-pending", async () => {
  const done = await uploaded();
  const pending = await createUpload({ filename: "p.png", type: "image/png", size: PNG.length });
  if (!pending.ok) throw new Error(pending.error);
  const ids = (await listMedia()).map((item) => item.id);
  expect(ids).toContain(done);
  expect(ids).not.toContain(pending.id);
  expect((await listMediaAction()).find((item) => item.id === done)).toEqual({
    id: done,
    filename: "photo.png",
    contentType: "image/png",
    size: PNG.length,
    alt: null,
    url: `/media/${done}.png`,
  });
});

test("sweeper-removes-abandoned", async () => {
  // Old: a pending row with its staging object, created 2 hours ago.
  const old = await createUpload({ filename: "old.png", type: "image/png", size: PNG.length });
  if (!old.ok) throw new Error(old.error);
  await put(old.url, PNG);
  await getDb()
    .update(media)
    .set({ createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) })
    .where(eq(media.id, old.id));
  const fresh = await createUpload({ filename: "new.png", type: "image/png", size: PNG.length });
  if (!fresh.ok) throw new Error(fresh.error);

  await sweepPendingUploads();
  expect(await rowOf(old.id)).toBeUndefined();
  expect(await objectExists(`uploads/${old.id}`)).toBe(false);
  expect(await rowOf(fresh.id)).toBeDefined();

  // A stray staging object with no pending row (a PUT after finish) goes when it is older than the cutoff.
  const { client, bucket } = getStorage();
  const stray = `uploads/${crypto.randomUUID()}`;
  const foreign = `uploads/${crypto.randomUUID()}/not-ours.txt`; // not a key createUpload makes
  for (const Key of [stray, foreign]) await client.send(new PutObjectCommand({ Bucket: bucket, Key, Body: PNG }));
  await sweepPendingUploads(new Date(Date.now() + 1000));
  expect(await objectExists(stray)).toBe(false);
  expect(await objectExists(foreign)).toBe(true);
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: foreign }));
});

test("alt-saved-and-capped", async () => {
  const id = await uploaded();
  expect(await updateAltAction({}, form({ id, alt: "  A red bike  " }))).toEqual({});
  expect((await rowOf(id)).alt).toBe("A red bike");
  expect(await updateAltAction({}, form({ id, alt: "ignored", decorative: "on" }))).toEqual({});
  expect((await rowOf(id)).alt).toBe("");
  expect(await updateAltAction({}, form({ id, alt: "x".repeat(ALT_MAX + 1) }))).toMatchObject({ error: expect.any(String) });
  expect((await rowOf(id)).alt).toBe("");
  // Any signed-in user may edit alt text.
  signedInAs(bob);
  expect(await updateAltAction({}, form({ id, alt: "Bike" }))).toEqual({});
  expect((await rowOf(id)).alt).toBe("Bike");
});

test("editor-deletes-own-only", async () => {
  const id = await uploaded();
  const key = (await rowOf(id)).key;
  signedInAs(bob);
  expect(await deleteMediaAction({}, form({ id }))).toEqual({ error: "You can delete only your own uploads." });
  expect(await rowOf(id)).toBeDefined();
  expect(await objectExists(key)).toBe(true);

  signedInAs(alice);
  expect(await deleteMediaAction({}, form({ id }))).toEqual({});
  expect(await rowOf(id)).toBeUndefined();
  expect(await objectExists(key)).toBe(false);

  signedInAs(bob);
  const bobs = await uploaded();
  signedInAs(admin);
  expect(await deleteMediaAction({}, form({ id: bobs }))).toEqual({});
  expect(await rowOf(bobs)).toBeUndefined();
});

test.each(["draft", "published", "old-revision"] as const)("delete-refused-when-used: %s", async (where) => {
  const id = await uploaded();
  const key = (await rowOf(id)).key;
  const using = { content: [{ type: "Image", props: { id: "b1", media: id } }], root: { props: {} } };
  const empty = { content: [], root: { props: {} } };
  const title = `Uses media ${where}`;
  const [page] = await getDb()
    .insert(pages)
    .values({ slug: `t-${crypto.randomUUID()}`, title, draft: where === "draft" ? using : empty })
    .returning();
  pageIds.push(page.id);
  if (where !== "draft") {
    const [revision] = await getDb().insert(pageRevisions).values({ pageId: page.id, data: using }).returning();
    // old-revision: a past version that is not live; restoring it (#12) needs the file.
    if (where === "published") {
      await getDb().update(pages).set({ publishedRevisionId: revision.id }).where(eq(pages.id, page.id));
    }
  }
  expect(await deleteMediaAction({}, form({ id }))).toEqual({
    error: `Used on: ${title}. Remove it from these pages first.`,
  });
  expect(await rowOf(id)).toBeDefined();
  expect(await objectExists(key)).toBe(true);
});
