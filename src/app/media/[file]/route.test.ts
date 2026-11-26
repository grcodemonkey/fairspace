// @vitest-environment node
// Integration: real test database and the SeaweedFS test bucket (pnpm db:up).
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, expect, test } from "vitest";
import { getDb } from "@/db";
import { media } from "@/db/schema";
import { getStorage } from "@/storage";
import { GET } from "./route";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52]);
const PDF = new TextEncoder().encode("%PDF-1.4\n%%EOF");
const png = { id: crypto.randomUUID(), filename: `a "b"\r\nX-Evil: 1 'c'.png`, contentType: "image/png", body: PNG };
const pdf = { id: crypto.randomUUID(), filename: "report.pdf", contentType: "application/pdf", body: PDF };
const pending = { id: crypto.randomUUID(), filename: "p.png", contentType: "image/png", body: PNG };
const all = [png, pdf, pending];
const keyOf = (f: (typeof all)[number]) => `media/${f.id}.${f.contentType === "image/png" ? "png" : "pdf"}`;

const get = (file: string) => GET(new Request(`http://localhost/media/${file}`), { params: Promise.resolve({ file }) });

beforeAll(async () => {
  const { client, bucket } = getStorage();
  for (const f of all) {
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: keyOf(f), Body: f.body, ContentType: "text/html" }));
  }
  await getDb()
    .insert(media)
    .values(
      all.map((f) => ({
        id: f.id,
        key: keyOf(f),
        filename: f.filename,
        contentType: f.contentType,
        size: f.body.length,
        uploadedAt: f === pending ? null : new Date(),
      })),
    );
});
afterAll(async () => {
  const { client, bucket } = getStorage();
  await getDb().delete(media).where(inArray(media.id, all.map((f) => f.id)));
  for (const f of all) await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: keyOf(f) }));
});

test("serve-fixed-headers", async () => {
  const res = await get(`${png.id}.png`);
  expect(res.status).toBe(200);
  // From the DB row, not from the object (stored as text/html above).
  expect(res.headers.get("content-type")).toBe("image/png");
  expect(res.headers.get("content-length")).toBe(String(PNG.length));
  expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  expect(res.headers.get("cache-control")).toBe("public, max-age=86400");
  expect(res.headers.get("content-disposition")).toBe(
    "inline; filename*=UTF-8''a%20%22b%22%0D%0AX-Evil%3A%201%20%27c%27.png",
  );
  expect(res.headers.get("content-security-policy")).toBe("default-src 'none'; style-src 'unsafe-inline'; sandbox");
  expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG);
});

test("serve-pdf-no-sandbox", async () => {
  const res = await get(`${pdf.id}.pdf`);
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toBe("application/pdf");
  expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  expect(res.headers.get("content-security-policy")).toBeNull();
});

test.each([
  ["serve-pending-404", () => `${pending.id}.png`],
  ["serve-wrong-ext-404", () => `${png.id}.pdf`],
  ["serve-bad-id-404", () => "not-a-uuid.png"],
  ["serve-unknown-id-404", () => `${crypto.randomUUID()}.png`],
  ["serve-upper-case-404", () => `${png.id.toUpperCase()}.png`],
])("%s", async (_, file) => {
  expect((await get(file())).status).toBe(404);
});
