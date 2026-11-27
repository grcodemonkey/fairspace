// @vitest-environment node
import type { Data } from "@puckeditor/core";
import { inArray } from "drizzle-orm";
import { afterAll, expect, test, vi } from "vitest";
import { getDb } from "./db";
import { media } from "./db/schema";
import { resolvePageMedia } from "./media-library";

// "use cache" is only a string outside Next; its helpers need a Next request.
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

const image = crypto.randomUUID();
const card = crypto.randomUUID();
const pdf = crypto.randomUUID();
const row = (id: string, contentType: string, ext: string, alt: string | null) =>
  ({ id, key: `media/${id}.${ext}`, filename: `f.${ext}`, contentType, size: 70, uploadedAt: new Date(), alt });

afterAll(() => getDb().delete(media).where(inArray(media.id, [image, card, pdf])));

const page = () => ({
  root: { props: { title: "T", socialImage: image } },
  content: [
    // A block id that contains a UUID is not a media id.
    { type: "Hero", props: { id: `Hero-${pdf}`, title: "x" } },
    { type: "Image", props: { id: "i", image, caption: "" } },
    { type: "CardGrid", props: { id: "c", cards: [{ image: card }, { image: pdf }, { image: crypto.randomUUID() }] } },
  ],
}) as Data;

test("resolver-finds-nested-ids", async () => {
  await getDb().insert(media).values([row(image, "image/png", "png", "A bike"), row(card, "image/jpeg", "jpg", null)]);
  expect(await resolvePageMedia(page())).toEqual({
    [image]: { url: `/media/${image}.png`, alt: "A bike" },
    [card]: { url: `/media/${card}.jpg`, alt: null },
  });
});

test("resolver-drops-unknown", async () => {
  await getDb().insert(media).values(row(pdf, "application/pdf", "pdf", "A PDF"));
  const map = await resolvePageMedia(page());
  expect(Object.keys(map).sort()).toEqual([image, card].sort());
});
