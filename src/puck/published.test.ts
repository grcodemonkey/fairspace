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

async function insertPage(name: string, draftTitle = "Draft", kind: "page" | "post" = "page") {
  const slug = `${name}-${run}`;
  slugs.push(slug);
  const [row] = await getDb().insert(pages).values({ kind, title: name, slug, draft: doc(draftTitle) }).returning();
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
  expect((await getPublishedPage(page.slug))?.data).toEqual(doc("Live title"));
});

test("draft-only-returns-null", async () => {
  const page = await insertPage("draft-only");
  expect(await getPublishedPage(page.slug)).toBeNull();
});

test("kind-filter", async () => {
  const post = await insertPage("post", "Draft", "post");
  await publish(post.id, post.id, "Post");
  const page = await insertPage("page");
  await publish(page.id, page.id, "Page");
  expect(await getPublishedPage(post.slug)).toBeNull();
  expect((await getPublishedPage(post.slug, "post"))?.data).toEqual(doc("Post"));
  expect(await getPublishedPage(page.slug, "post")).toBeNull();
});

test("unknown-slug-returns-null", async () => {
  expect(await getPublishedPage(`no-such-page-${run}`)).toBeNull();
});

test("revision-of-other-page-rejected-by-db", async () => {
  const page = await insertPage("victim");
  const other = await insertPage("other");
  await expect(publish(page.id, other.id, "Other page")).rejects.toMatchObject({ cause: { code: "23503" } });
  expect(await getPublishedPage(page.slug)).toBeNull();
});

test("page-delete-cascades-revisions", async () => {
  const page = await insertPage("deleted");
  await publish(page.id, page.id, "Live");
  await getDb().delete(pages).where(eq(pages.id, page.id));
  expect(await getDb().select().from(pageRevisions).where(eq(pageRevisions.pageId, page.id))).toHaveLength(0);
});
