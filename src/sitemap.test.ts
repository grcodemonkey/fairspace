// @vitest-environment node
import type { Data } from "@puckeditor/core";
import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, expect, test, vi } from "vitest";
import { getDb } from "@/db";
import { pageRevisions, pages } from "@/db/schema";
import { getSitemapEntries, siteUrl } from "./sitemap";

// "use cache" is a no-op outside Next; stub the cache APIs it calls.
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

const run = crypto.randomUUID().slice(0, 8);
const slugs: string[] = [];

async function insert(name: string, opts: { published?: boolean; noindex?: boolean; kind?: "page" | "post" } = {}) {
  const slug = name === "home" ? name : `${name}-${run}`;
  slugs.push(slug);
  // noindex is a field of the Puck config, so Data's root props type does not list it.
  const data = { root: { props: opts.noindex === undefined ? {} : { noindex: opts.noindex } }, content: [] } as Data;
  const [page] = await getDb()
    .insert(pages)
    .values({ kind: opts.kind ?? "page", title: slug, slug, draft: data })
    .returning();
  const [rev] = await getDb().insert(pageRevisions).values({ pageId: page.id, data }).returning();
  if (opts.published ?? true)
    await getDb().update(pages).set({ publishedRevisionId: rev.id }).where(eq(pages.id, page.id));
  return { path: opts.kind === "post" ? `/news/${slug}` : `/${slug}`, rev };
}

afterAll(async () => {
  await getDb().delete(pages).where(inArray(pages.slug, slugs));
});

test("sitemap-lists-live-indexable", async () => {
  const live = await insert("live");
  const post = await insert("post", { kind: "post", noindex: false });
  await insert("draft", { published: false });
  await insert("hidden", { noindex: true });
  await insert("hidden-post", { kind: "post", noindex: true });
  const entries = (await getSitemapEntries()).filter((e) => e.path.endsWith(run));
  expect(entries.map((e) => e.path).sort()).toEqual([live.path, post.path].sort());
  expect(entries.find((e) => e.path === live.path)?.lastModified).toEqual(live.rev.createdAt);
});

test("sitemap-home-is-root", async () => {
  // The slug is unique and the DB can already have a home page: only check it when it is free.
  const [existing] = await getDb().select({ id: pages.id }).from(pages).where(eq(pages.slug, "home"));
  if (existing) return;
  await insert("home");
  expect((await getSitemapEntries()).map((e) => e.path)).toContain("/");
});

afterEach(() => vi.unstubAllEnvs());

test("site-url-order", () => {
  vi.stubEnv("AUTH_URL", "");
  vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
  expect(siteUrl()).toBeNull();
  vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "example.vercel.app");
  expect(siteUrl()?.href).toBe("https://example.vercel.app/");
  vi.stubEnv("AUTH_URL", "not a url");
  expect(siteUrl()?.href).toBe("https://example.vercel.app/");
  vi.stubEnv("AUTH_URL", "https://example.org");
  expect(siteUrl()?.href).toBe("https://example.org/");
});
