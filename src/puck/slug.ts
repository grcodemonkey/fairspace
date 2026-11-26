// The DB check `pages_slug_format` and the unique index are the real gate. This only gives a friendly error.
export const SLUG_FORMAT = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Paths the app owns. A page with one of these slugs could never be shown.
export const RESERVED_SLUGS = ["admin", "api", "sign-in"];

export const normalizeSlug = (slug: string) => slug.trim().toLowerCase();
