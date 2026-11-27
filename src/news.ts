import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { getDb } from "@/db";
import { pageRevisions, pages } from "@/db/schema";
import type { MediaMeta } from "@/media";
import { getMediaMeta } from "@/media-library";
import { FEED_PATH } from "@/puck/seo";
import { publicPath } from "@/puck/slug";

// invalidatePage (src/puck/publish.ts) expires it on every change to what is live.
export const NEWS_TAG = "news";
export const NEWS_PAGE_SIZE = 10;

export type NewsPost = {
  slug: string;
  title: string;
  description: string;
  image: MediaMeta | null;
  publishedAt: Date;
};

/** One page (1-based) of published posts, newest first. The text comes from the published root props, never pages.title (the draft). */
export async function getNewsPage(n: number): Promise<{ posts: NewsPost[]; hasOlder: boolean }> {
  "use cache";
  cacheLife("max");
  cacheTag(NEWS_TAG);
  const rows = await getDb()
    .select({
      slug: pages.slug,
      publishedAt: pages.publishedAt,
      props: sql<Record<string, unknown> | null>`${pageRevisions.data}->'root'->'props'`,
    })
    .from(pages)
    .innerJoin(
      pageRevisions,
      and(eq(pageRevisions.id, pages.publishedRevisionId), eq(pageRevisions.pageId, pages.id)),
    )
    .where(and(eq(pages.kind, "post"), isNotNull(pages.publishedAt)))
    // id last: a stable order, so a post never shows on two pages.
    .orderBy(sql`${pages.publishedAt} desc nulls last`, desc(pages.createdAt), pages.id) // nulls last: matches the index
    .limit(NEWS_PAGE_SIZE + 1)
    .offset((n - 1) * NEWS_PAGE_SIZE);
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const posts = await Promise.all(
    rows.slice(0, NEWS_PAGE_SIZE).map(async ({ slug, publishedAt, props }) => ({
      slug,
      title: text(props?.title) || slug,
      description: text(props?.description),
      // getMediaMeta is cached by mediaTag, so an alt change shows here too.
      image: typeof props?.socialImage === "string" ? await getMediaMeta(props.socialImage) : null,
      publishedAt: publishedAt!,
    })),
  );
  return { posts, hasOlder: rows.length > NEWS_PAGE_SIZE };
}

/**
 * The public origin for absolute URLs: AUTH_URL, else Vercel's production URL, else null.
 * Never the Host header: a visitor controls it, and a cache would keep the poisoned links.
 * shortcut: same logic as siteUrl() in #23 (src/sitemap.ts); switch to that helper once it is on main.
 */
export function siteUrl(): URL | null {
  const authUrl = process.env.AUTH_URL;
  if (authUrl && URL.canParse(authUrl)) return new URL(authUrl);
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return vercel && URL.canParse(`https://${vercel}`) ? new URL(`https://${vercel}`) : null;
}

/** Escapes text for XML and drops the characters XML 1.0 refuses (most C0 controls, U+FFFE, U+FFFF, lone surrogates). */
export function xmlEscape(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "")
    .replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
}

/** RSS 2.0 for the newest posts. Summary only: the description is the post's excerpt as plain text. */
export function buildRss({
  siteName,
  description,
  base,
  posts,
}: {
  siteName: string;
  description: string;
  base: URL;
  posts: Pick<NewsPost, "slug" | "title" | "description" | "publishedAt">[];
}): string {
  const url = (path: string) => xmlEscape(new URL(path, base).href);
  const items = posts.map(
    (post) => `
    <item>
      <title>${xmlEscape(post.title)}</title>
      <link>${url(publicPath("post", post.slug))}</link>
      <guid isPermaLink="true">${url(publicPath("post", post.slug))}</guid>
      <pubDate>${post.publishedAt.toUTCString()}</pubDate>${post.description ? `
      <description>${xmlEscape(post.description)}</description>` : ""}
    </item>`,
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(siteName)}</title>
    <link>${url("/news")}</link>
    <description>${xmlEscape(description)}</description>
    <atom:link href="${url(FEED_PATH)}" rel="self" type="application/rss+xml"/>${items.join("")}
  </channel>
</rss>
`;
}
