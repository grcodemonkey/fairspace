import type { Metadata } from "next";

export const FEED_PATH = "/news/feed.xml";

/** The news feed link in every public page head (`alternates.types`). */
export const feedAlternate = (siteName: string) => ({ "application/rss+xml": [{ url: FEED_PATH, title: siteName }] });

/** Longest page description and site default description. */
export const SEO_DESCRIPTION_MAX = 300;

/**
 * The page's search and sharing tags from the published root props. Pure: `image`, `siteUrl`, `siteName` and `defaultDescription` come from the caller (the caller picks the default share image when the page has none).
 * og:title stays the page title only: the site layout's template adds " · <site name>" to <title>, and og:site_name has the name.
 * Absent or wrong-typed props are skipped, so an old revision still renders.
 */
export function pageMetadata({
  props,
  path,
  image,
  publishedTime,
  siteUrl,
  siteName,
  defaultDescription,
}: {
  props: Record<string, unknown> | undefined;
  // From publicPath: the canonical and og:url.
  path: string;
  image: { url: string; alt: string | null } | null;
  siteUrl: string | undefined;
  siteName: string;
  defaultDescription: string | null;
  // News posts only: makes the share card an article with its date.
  publishedTime?: Date | null;
}): Metadata {
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const title = text(props?.title);
  const description = text(props?.description) || defaultDescription || "";
  return {
    ...(title && { title }),
    ...(description && { description }),
    // Relative: resolved against metadataBase. It replaces the layout's `alternates` as a whole, so it repeats the feed.
    alternates: { canonical: path, types: feedAlternate(siteName) },
    ...(props?.noindex === true && { robots: { index: false } }),
    openGraph: {
      ...(publishedTime ? { type: "article", publishedTime: publishedTime.toISOString() } : { type: "website" }),
      url: path,
      siteName,
      ...(title && { title }),
      ...(description && { description }),
      ...(image && { images: [{ url: image.url, ...(image.alt && { alt: image.alt }) }] }),
    },
    // No valid siteUrl: Next resolves relative og images against the Vercel URL or localhost, but canonical and og:url stay relative. Callers pass siteUrl() from @/sitemap (AUTH_URL, else the Vercel production URL).
    ...(siteUrl && URL.canParse(siteUrl) && { metadataBase: new URL(siteUrl) }),
  };
}
