import type { Metadata } from "next";

/** Longest page description and site default description. */
export const SEO_DESCRIPTION_MAX = 300;

/**
 * The page's search and sharing tags from the published root props. Pure: `image`, `siteUrl`, `siteName` and `defaultDescription` come from the caller (the caller picks the default share image when the page has none).
 * og:title stays the page title only: the site layout's template adds " · <site name>" to <title>, and og:site_name has the name.
 * Absent or wrong-typed props are skipped, so an old revision still renders.
 */
export function pageMetadata({
  props,
  slug,
  image,
  siteUrl,
  siteName,
  defaultDescription,
}: {
  props: Record<string, unknown> | undefined;
  slug: string;
  image: { url: string; alt: string | null } | null;
  siteUrl: string | undefined;
  siteName: string;
  defaultDescription: string | null;
}): Metadata {
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const title = text(props?.title);
  const description = text(props?.description) || defaultDescription || "";
  const canonical = slug === "home" ? "/" : `/${slug}`;
  return {
    ...(title && { title }),
    ...(description && { description }),
    // Relative: resolved against metadataBase.
    alternates: { canonical },
    ...(props?.noindex === true && { robots: { index: false } }),
    openGraph: {
      type: "website",
      url: canonical,
      siteName,
      ...(title && { title }),
      ...(description && { description }),
      ...(image && { images: [{ url: image.url, ...(image.alt && { alt: image.alt }) }] }),
    },
    // Without a valid AUTH_URL, Next falls back to the Vercel URL or localhost.
    ...(siteUrl && URL.canParse(siteUrl) && { metadataBase: new URL(siteUrl) }),
  };
}
