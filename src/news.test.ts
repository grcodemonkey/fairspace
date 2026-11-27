// @vitest-environment jsdom
import { eq, inArray } from "drizzle-orm";
import { afterAll, expect, test, vi } from "vitest";
import { getDb } from "@/db";
import { pageRevisions, pages } from "@/db/schema";
import { buildRss, getNewsPage, NEWS_PAGE_SIZE } from "./news";

// "use cache" is a no-op outside Next; stub the cache APIs it calls.
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

const run = crypto.randomUUID().slice(0, 8);
const slugs: string[] = [];
const doc = (title: string, description = "") => ({ root: { props: { title, description } }, content: [] });

// Dates in 2099 sort before any other post in the shared test DB.
async function insertPost(name: string, publishedAt: Date | null, opts: { kind?: "page" | "post"; draftTitle?: string } = {}) {
  const slug = `${name}-${run}`;
  slugs.push(slug);
  const [row] = await getDb()
    .insert(pages)
    .values({ kind: opts.kind ?? "post", title: "Row title", slug, draft: doc(opts.draftTitle ?? "Draft"), publishedAt })
    .returning();
  if (publishedAt) {
    const [rev] = await getDb().insert(pageRevisions).values({ pageId: row.id, data: doc(`Live ${name}`, `About ${name}`) }).returning();
    await getDb().update(pages).set({ publishedRevisionId: rev.id }).where(eq(pages.id, row.id));
  }
  return slug;
}

afterAll(async () => {
  await getDb().delete(pages).where(inArray(pages.slug, slugs)); // cascades to page_revisions
});

test("news-order-filter-and-paging", async () => {
  const day = (d: number) => new Date(Date.UTC(2099, 0, d));
  // Same publish date: the later created post comes first.
  const sameA = await insertPost("same-a", day(20));
  const sameB = await insertPost("same-b", day(20), { draftTitle: "Unsaved draft title" });
  await insertPost("unpublished", null);
  await insertPost("a-page", day(25), { kind: "page" });
  const older: string[] = [];
  for (let i = 1; i <= NEWS_PAGE_SIZE; i++) older.push(await insertPost(`older-${i}`, day(19 - i)));

  const first = await getNewsPage(1);
  expect(first.posts.map((p) => p.slug)).toEqual([sameB, sameA, ...older.slice(0, NEWS_PAGE_SIZE - 2)]);
  expect(first.hasOlder).toBe(true);
  // The published revision, not the draft or pages.title.
  expect(first.posts[0]).toMatchObject({ title: "Live same-b", description: "About same-b", image: null, publishedAt: day(20) });

  const second = await getNewsPage(2);
  expect(second.posts.slice(0, 2).map((p) => p.slug)).toEqual(older.slice(NEWS_PAGE_SIZE - 2));
});

test("rss-hostile-text-parses", () => {
  // Lone surrogates are dropped; a valid pair (an emoji) stays.
  const hostile = `Tom & "Jerry's" <b>bold</b> ]]> end\u0001\u000B\uFFFE\uFFFF\uD800x\uDC00 \uD83D\uDE00`;
  const xml = buildRss({
    siteName: "Riverside & Co <news>",
    description: hostile,
    base: new URL("https://example.org"),
    posts: [{ slug: "first-post", title: hostile, description: hostile, publishedAt: new Date(Date.UTC(2026, 10, 20, 15)) }],
  });
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  expect(doc.querySelector("parsererror")).toBeNull();
  const item = doc.querySelector("item")!;
  expect(item.querySelector("title")?.textContent).toBe(`Tom & "Jerry's" <b>bold</b> ]]> endx 😀`);
  expect(item.querySelector("link")?.textContent).toBe("https://example.org/news/first-post");
  expect(item.querySelector("guid")?.getAttribute("isPermaLink")).toBe("true");
  expect(item.querySelector("pubDate")?.textContent).toBe("Fri, 20 Nov 2026 15:00:00 GMT");
  expect(doc.querySelector("channel > title")?.textContent).toBe("Riverside & Co <news>");
  expect(doc.querySelector("channel > link")?.textContent).toBe("https://example.org/news");
  expect(xml).toContain('<atom:link href="https://example.org/news/feed.xml" rel="self" type="application/rss+xml"/>');
});

test("rss-no-description-no-element", () => {
  const xml = buildRss({
    siteName: "S",
    description: "D",
    base: new URL("https://example.org/"),
    posts: [{ slug: "p", title: "T", description: "", publishedAt: new Date() }],
  });
  expect(new DOMParser().parseFromString(xml, "application/xml").querySelector("item description")).toBeNull();
});
