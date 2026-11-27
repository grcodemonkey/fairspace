import type { Data } from "@puckeditor/core";
import { eq, sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import type { getDb } from "@/db";
import { pageRevisions, pages } from "@/db/schema";
import { MENU_TAG } from "@/menu";
import { NEWS_TAG } from "@/news";
import { SITEMAP_TAG } from "@/sitemap";
import { pageTag } from "./published";

// Server code only: the callers are server actions. Data must already have passed parsePageData.
type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

/** Locks the page row, so publish, restore and unpublish of one page run one after the other. */
export async function lockPage(tx: Tx, id: string) {
  const [page] = await tx
    .select({ id: pages.id, slug: pages.slug, publishedRevisionId: pages.publishedRevisionId })
    .from(pages)
    .where(eq(pages.id, id))
    .for("update");
  return page ?? null;
}

/**
 * Takes the one lock that makes "pages.slug is unique" and "not a redirect slug" a single check: no unique index
 * can span two tables. Every writer of pages.slug or slug_redirects takes it first, then lockPage (never the reverse).
 */
export async function lockSlugs(tx: Tx) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('fairspace:slugs'))`);
}

/** Adds a revision with `data`, makes it live, and sets the draft to it. Call after lockPage. */
export async function goLive(tx: Tx, pageId: string, data: Data, userId: string | null) {
  // clock_timestamp(), not now(): now() is the transaction start, so a publish that waited for the lock could sort first.
  const [revision] = await tx
    .insert(pageRevisions)
    .values({ pageId, data, createdBy: userId, createdAt: sql`clock_timestamp()` })
    .returning({ id: pageRevisions.id });
  // Same title rule as saveDraft: the root Title field, and an empty one keeps the old title.
  const title = typeof data.root.props?.title === "string" ? data.root.props.title.trim() : "";
  await tx
    .update(pages)
    .set({
      publishedRevisionId: revision.id,
      // Only the first publish sets it: republish and restore keep the date. Pages get it too; only posts show it.
      publishedAt: sql`coalesce(${pages.publishedAt}, clock_timestamp())`,
      draft: data,
      ...(title && { title }),
      updatedAt: new Date(),
      updatedBy: userId,
    })
    .where(eq(pages.id, pageId));
  return revision.id;
}

/**
 * Makes the public page show the new live state on the next request. Call only after the transaction commits,
 * and only from a server action (updateTag works nowhere else).
 */
export function invalidatePage(slug: string) {
  updateTag(pageTag(slug));
  updateTag(MENU_TAG); // the menu hides links to pages that are not live
  updateTag(SITEMAP_TAG); // the sitemap lists live pages and posts
  updateTag(NEWS_TAG); // pages too: the caller does not know the kind, and the extra refresh is one cached query
}
