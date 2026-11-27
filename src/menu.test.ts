// @vitest-environment node
import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { getDb } from "@/db";
import { menuItems, pageRevisions, pages } from "@/db/schema";
import { getMenu, MenuError, pageHref, parseMenu } from "./menu";

// "use cache" is a no-op outside Next; stub the cache APIs it calls.
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

// The menu is one table for the whole site, so each test sets it from empty. Vitest runs files in parallel: this
// lock keeps this file and src/app/admin/menu/actions.test.ts apart. Closing the connection releases it.
const lock = postgres(process.env.DATABASE_URL!, { max: 1 });
beforeAll(async () => {
  await lock`select pg_advisory_lock(19)`;
});

const run = crypto.randomUUID().slice(0, 8);
const slugs: string[] = [];
const doc = { root: { props: {} }, content: [] };

async function insertPage(slug: string, published: boolean) {
  slugs.push(slug);
  const [page] = await getDb().insert(pages).values({ title: `Title ${slug}`, slug, draft: doc }).returning();
  if (published) {
    const [rev] = await getDb().insert(pageRevisions).values({ pageId: page.id, data: doc }).returning();
    await getDb().update(pages).set({ publishedRevisionId: rev.id }).where(eq(pages.id, page.id));
  }
  return page;
}
const item = (label: string, link: { pageId?: string; url?: string }, children: object[] = []) => ({
  label,
  pageId: link.pageId ?? null,
  url: link.url ?? null,
  children,
});
async function store(items: ReturnType<typeof item>[]) {
  for (const [position, top] of parseMenu(items).entries()) {
    const [row] = await getDb()
      .insert(menuItems)
      .values({ position, label: top.label, pageId: top.pageId, url: top.url })
      .returning();
    for (const [i, child] of top.children.entries())
      await getDb().insert(menuItems).values({ parentId: row.id, position: i, label: child.label, pageId: child.pageId, url: child.url });
  }
}

beforeEach(async () => {
  await getDb().delete(menuItems);
});
afterAll(async () => {
  await getDb().delete(menuItems);
  await getDb().delete(pages).where(inArray(pages.slug, slugs));
  await lock.end();
});

test("unsafe-url-refused", () => {
  expect(() => parseMenu([item("Bad", { url: "javascript:alert(1)" })])).toThrow(MenuError);
  expect(() => parseMenu([item("Bad", { url: "//evil.example" })])).toThrow(/must start with/);
});

test("third-level-refused", () => {
  const deep = [item("Top", { url: "/" }, [item("Child", { url: "/a" }, [item("Grandchild", { url: "/b" })])])];
  expect(() => parseMenu(deep)).toThrow("The menu allows two levels only.");
});

test("empty-label-refused", () => {
  expect(() => parseMenu([item("  ", { url: "/" })])).toThrow("Every item needs a label.");
  expect(() => parseMenu([item("x".repeat(61), { url: "/" })])).toThrow(/at most 60/);
  expect(() => parseMenu([item("Both", { url: "/", pageId: "p" })])).toThrow(/needs a page or a URL/);
  expect(() => parseMenu([item("None", {})])).toThrow(/needs a page or a URL/);
});

test("too-many-items-refused", () => {
  const children = Array.from({ length: 49 }, (_, i) => item(`Child ${i}`, { url: "/" }));
  expect(parseMenu([item("Top", { url: "/" }, children)])).toHaveLength(1);
  expect(() => parseMenu([item("Top", { url: "/" }, children), item("One more", { url: "/" })])).toThrow(/at most 50/);
});

test("unpublished-page-item-hidden", async () => {
  const live = await insertPage(`live-${run}`, true);
  const draft = await insertPage(`draft-${run}`, false);
  await store([item("Live", { pageId: live.id }), item("Secret plans", { pageId: draft.id })]);
  const menu = await getMenu();
  expect(menu).toEqual([{ label: "Live", href: `/live-${run}`, children: [] }]);
  expect(JSON.stringify(menu)).not.toContain("Secret");
});

test("hidden-parent-hides-children", async () => {
  const draft = await insertPage(`parent-${run}`, false);
  await store([item("Parent", { pageId: draft.id }, [item("Child", { url: "https://example.org" })])]);
  expect(await getMenu()).toEqual([]);
});

test("url-item-shown", async () => {
  await store([item("Donate", { url: "https://example.org/donate" }, [item("Mail", { url: "mailto:hi@example.org" })])]);
  expect(await getMenu()).toEqual([
    { label: "Donate", href: "https://example.org/donate", children: [{ label: "Mail", href: "mailto:hi@example.org", children: [] }] },
  ]);
});

// Pure: the `home` row is shared with src/app/admin/pages/actions.test.ts, which runs at the same time.
test("home-page-links-to-root", () => {
  expect(pageHref("home")).toBe("/");
  expect(pageHref("about")).toBe("/about");
});

test("slug-change-followed", async () => {
  const page = await insertPage(`old-${run}`, true);
  await store([item("Moved", { pageId: page.id })]);
  slugs.push(`new-${run}`);
  await getDb().update(pages).set({ slug: `new-${run}` }).where(eq(pages.id, page.id));
  expect(await getMenu()).toEqual([{ label: "Moved", href: `/new-${run}`, children: [] }]);
});

test("page-delete-removes-item", async () => {
  const page = await insertPage(`gone-${run}`, true);
  await store([item("Gone", { pageId: page.id }, [item("Child", { url: "/" })])]);
  await getDb().delete(pages).where(eq(pages.id, page.id));
  expect(await getDb().select().from(menuItems)).toHaveLength(0);
});
