import type { Data } from "@puckeditor/core";
import { and, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { getDb } from "@/db";
import { pageRevisions, pages } from "@/db/schema";

// Every write that changes what is live calls `invalidatePage(slug)` (src/puck/publish.ts) after its commit: publish
// (the first publish of `home` replaces the welcome fallback), restore and unpublish. A future slug change must call
// it for both the old and the new slug.
export const pageTag = (slug: string) => `page:${slug}`;

// The published revision only, never `pages.draft`. The pages_published_revision_same_page_fk FK already keeps a
// page on its own revisions; the pageId match is defense in depth.
// shortcut: each unknown valid-format slug caches a null entry with cacheLife("max"); add a slug-existence
// check or shorter 404 caching if cache growth shows up.
export async function getPublishedPage(slug: string): Promise<Data | null> {
  "use cache";
  cacheLife("max");
  cacheTag(pageTag(slug));
  const [row] = await getDb()
    .select({ data: pageRevisions.data })
    .from(pages)
    .innerJoin(
      pageRevisions,
      and(eq(pageRevisions.id, pages.publishedRevisionId), eq(pageRevisions.pageId, pages.id)),
    )
    .where(eq(pages.slug, slug))
    .limit(1);
  return row?.data ?? null;
}
