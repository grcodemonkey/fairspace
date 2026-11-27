import { and, asc, eq, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { getDb } from "@/db";
import { pageRevisions, pages } from "@/db/schema";
import { publicPath } from "@/puck/slug";

// Every change to what is live (invalidatePage in src/puck/publish.ts) calls updateTag(SITEMAP_TAG).
export const SITEMAP_TAG = "sitemap";

/**
 * The public origin of the site, for absolute URLs outside a request: AUTH_URL, else Vercel's production URL, else null.
 * Never read the Host header: a visitor controls it. Shared by the sitemap, robots.txt and the news feed.
 */
export function siteUrl(): URL | null {
  const authUrl = process.env.AUTH_URL;
  if (authUrl && URL.canParse(authUrl)) return new URL(authUrl);
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return vercel && URL.canParse(`https://${vercel}`) ? new URL(`https://${vercel}`) : null;
}

export type SitemapEntry = { path: string; lastModified: Date };

/** Live pages and posts at their current slugs, without `noindex`. The path only: the caller adds the origin. */
export async function getSitemapEntries(): Promise<SitemapEntry[]> {
  "use cache";
  cacheLife("max");
  cacheTag(SITEMAP_TAG);
  const rows = await getDb()
    .select({ kind: pages.kind, slug: pages.slug, lastModified: pageRevisions.createdAt })
    .from(pages)
    .innerJoin(
      pageRevisions,
      and(eq(pageRevisions.id, pages.publishedRevisionId), eq(pageRevisions.pageId, pages.id)),
    )
    .where(sql`coalesce(${pageRevisions.data}->'root'->'props'->'noindex' = 'true'::jsonb, false) = false`)
    .orderBy(asc(pages.kind), asc(pages.slug));
  return rows.map((row) => ({ path: publicPath(row.kind, row.slug), lastModified: row.lastModified }));
}
