import type { Metadata } from "next";

/**
 * The page's search and sharing tags from the published root props. Pure: `image` and `siteUrl` come from the caller.
 * Absent or wrong-typed props are skipped, so an old revision still renders.
 */
export function pageMetadata({
  props,
  slug,
  image,
  siteUrl,
}: {
  props: Record<string, unknown> | undefined;
  slug: string;
  image: { url: string; alt: string | null } | null;
  siteUrl: string | undefined;
}): Metadata {
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const title = text(props?.title);
  const description = text(props?.description);
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
      ...(title && { title }),
      ...(description && { description }),
      ...(image && { images: [{ url: image.url, ...(image.alt && { alt: image.alt }) }] }),
    },
    // Without a valid AUTH_URL, Next falls back to the Vercel URL or localhost.
    ...(siteUrl && URL.canParse(siteUrl) && { metadataBase: new URL(siteUrl) }),
  };
}
