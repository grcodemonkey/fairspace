// The DB check `pages_slug_format` and the unique index are the real gate for format and duplicates.
// This copy only gives a friendly error.
export const SLUG_FORMAT = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Paths the app owns. A page with one of these slugs could never be shown. `news` is the post index (#22).
// Enforced in code only (createPage): the database does not block them.
export const RESERVED_SLUGS = ["admin", "api", "media", "news", "sign-in"];

export const normalizeSlug = (slug: string) => slug.trim().toLowerCase();

/** The public URL path of a page or a news post. Links, canonical URLs, the sitemap and redirects all use it. */
export const publicPath = (kind: "page" | "post", slug: string) =>
  kind === "post" ? `/news/${slug}` : slug === "home" ? "/" : `/${slug}`;
