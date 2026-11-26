import type { Data } from "@puckeditor/core";
import { and, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { getDb } from "@/db";
import { pageRevisions, pages } from "@/db/schema";

// #12: call `updateTag(pageTag(slug))` after publish or restore, and for the old and new slug on a slug change.
export const pageTag = (slug: string) => `page:${slug}`;

// The published revision only, never `pages.draft`. The pageId match ignores a revision of another page.
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
