import type { Data } from "@puckeditor/core";
import { and, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { getDb } from "@/db";
import { pageRevisions, pages } from "@/db/schema";

// #12: call `updateTag(pageTag(slug))` on the first publish of a slug (including `home`, which replaces the
// welcome fallback), on every publish and restore, and for both the old and the new slug on a slug change.
export const pageTag = (slug: string) => `page:${slug}`;

// The published revision only, never `pages.draft`. The pageId match ignores a revision of another page.
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
