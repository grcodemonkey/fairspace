import type { Data } from "@puckeditor/core";
import { and, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { getDb } from "@/db";
import { pageRevisions, pages, slugRedirects } from "@/db/schema";
import { publicPath } from "./slug";

// Every write that changes what is live calls `invalidatePage(slug)` (src/puck/publish.ts) after its commit: publish
// (the first publish of `home` replaces the welcome fallback), restore, unpublish, a post's date change and a slug
// change (for both the old and the new slug). Slugs are unique across pages and posts, so one tag per slug. A cached
// redirect carries the tag of its old slug and of the target's current slug, so a rename or an unpublish clears it.
export const pageTag = (slug: string) => `page:${slug}`;

export type PublishedPage = { data: Data; publishedAt: Date | null };
export type PublishedRedirect = { redirectTo: string };

// The published revision only, never `pages.draft`. The pages_published_revision_same_page_fk FK already keeps a
// page on its own revisions; the pageId match is defense in depth. A post slug is not served as a page, and the reverse.
// shortcut: each unknown valid-format slug caches a null entry with cacheLife("max"); add a slug-existence
// check or shorter 404 caching if cache growth shows up.
export async function getPublishedPage(
  slug: string,
  kind: "page" | "post" = "page",
): Promise<PublishedPage | PublishedRedirect | null> {
  "use cache";
  cacheLife("max");
  cacheTag(pageTag(slug));
  const [row] = await getDb()
    .select({ data: pageRevisions.data, publishedAt: pages.publishedAt })
    .from(pages)
    .innerJoin(
      pageRevisions,
      and(eq(pageRevisions.id, pages.publishedRevisionId), eq(pageRevisions.pageId, pages.id)),
    )
    .where(and(eq(pages.slug, slug), eq(pages.kind, kind)))
    .limit(1);
  if (row) return row;
  // No live page has this slug. An old slug redirects to the page's current address, and only when that page is live
  // (the new address of an unpublished page stays hidden). A page with this slug wins over a redirect: pages are checked first.
  const [target] = await getDb()
    .select({ slug: pages.slug, publishedRevisionId: pages.publishedRevisionId })
    .from(slugRedirects)
    .innerJoin(pages, eq(pages.id, slugRedirects.pageId))
    .where(and(eq(slugRedirects.slug, slug), eq(pages.kind, kind)))
    .limit(1);
  if (!target) return null;
  // Tagged after the query: the target slug is known only now. A publish, unpublish or rename of the target clears this entry.
  cacheTag(pageTag(target.slug));
  return target.publishedRevisionId ? { redirectTo: publicPath(kind, target.slug) } : null;
}

/** Narrows the loader result: a redirect has `redirectTo`, a page has `data`. */
export const isRedirect = (page: PublishedPage | PublishedRedirect): page is PublishedRedirect => "redirectTo" in page;
