// @vitest-environment node
// Integration: real test database and the SeaweedFS test bucket (pnpm db:up).
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { getDb } from "@/db";
import { media, users } from "@/db/schema";
import { requireUser } from "@/guards";
import { MAX_BYTES } from "@/media";
import { getStorage } from "@/storage";
import { createUpload, finishUpload } from "./actions";

vi.mock("@/guards", () => ({ requireUser: vi.fn() }));

const alice = { id: crypto.randomUUID(), email: `alice-${crypto.randomUUID()}@example.com`, role: "editor" as const };
const bob = { id: crypto.randomUUID(), email: `bob-${crypto.randomUUID()}@example.com`, role: "editor" as const };
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52]);

const signedInAs = (user: typeof alice) => vi.mocked(requireUser).mockResolvedValue(user);
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
  await getDb().delete(media).where(inArray(media.uploadedBy, [alice.id, bob.id]));
  await getDb().delete(users).where(inArray(users.id, [alice.id, bob.id]));
});

test("presign-scoped-key", async () => {
  const result = await createUpload({ filename: "../../etc/passwd.png", type: "image/png", size: PNG.length });
  if (!result.ok) throw new Error(result.error);
  const url = new URL(result.url);
  const row = await rowOf(result.id);
  expect(row.key).toBe(`media/${result.id}.png`); // the server picks the key, not the filename
  expect(url.pathname).toBe(`/fairspace-test/${row.key}`);
  expect(Number(url.searchParams.get("X-Amz-Expires"))).toBeLessThanOrEqual(300);
  expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("content-length;content-type;host");
  expect(row.uploadedAt).toBeNull();

  expect((await put(result.url, PNG)).status).toBe(200);
  expect(await finishUpload(result.id)).toEqual({ ok: true, filename: "../../etc/passwd.png" });
  expect((await rowOf(result.id)).uploadedAt).toBeInstanceOf(Date);
  // A finished upload cannot be finished again.
  expect(await finishUpload(result.id)).toMatchObject({ ok: false });
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
});
