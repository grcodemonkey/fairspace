// @vitest-environment node
import { eq, inArray } from "drizzle-orm";
import { afterAll, expect, test, vi } from "vitest";
import { getDb } from "@/db";
import { pageRevisions, pages } from "@/db/schema";
import { getPublishedPage } from "./published";

// "use cache" is a no-op outside Next; stub the cache APIs it calls.
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

const run = crypto.randomUUID().slice(0, 8);
const slugs: string[] = [];
const doc = (title: string) => ({ root: { props: { title } }, content: [] });

async function insertPage(name: string, draftTitle = "Draft") {
  const slug = `${name}-${run}`;
  slugs.push(slug);
  const [row] = await getDb().insert(pages).values({ title: name, slug, draft: doc(draftTitle) }).returning();
  return row;
}
async function publish(pageId: string, revisionOf: string, title: string) {
  const [rev] = await getDb().insert(pageRevisions).values({ pageId: revisionOf, data: doc(title) }).returning();
  await getDb().update(pages).set({ publishedRevisionId: rev.id }).where(eq(pages.id, pageId));
}

afterAll(async () => {
  await getDb().delete(pages).where(inArray(pages.slug, slugs)); // cascades to page_revisions
});

test("published-returns-revision-data", async () => {
  const page = await insertPage("published", "Not live yet");
  await publish(page.id, page.id, "Live title");
  expect(await getPublishedPage(page.slug)).toEqual(doc("Live title"));
});

test("draft-only-returns-null", async () => {
  const page = await insertPage("draft-only");
  expect(await getPublishedPage(page.slug)).toBeNull();
});

test("unknown-slug-returns-null", async () => {
  expect(await getPublishedPage(`no-such-page-${run}`)).toBeNull();
});

test("other-page-revision-ignored", async () => {
  const page = await insertPage("victim");
  const other = await insertPage("other");
  await publish(page.id, other.id, "Other page");
  expect(await getPublishedPage(page.slug)).toBeNull();
});
