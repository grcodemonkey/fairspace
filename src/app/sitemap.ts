import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getSitemapEntries, siteUrl } from "@/sitemap";

// shortcut: one sitemap file holds 50,000 URLs; use generateSitemaps if a site ever passes that.
// #22 (news index) adds the `/news` entry here.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection(); // request time: `next build` has no database, and the URLs need the run-time AUTH_URL
  const base = siteUrl();
  // A missing DATABASE_URL (a build, a bare deploy) gives an empty sitemap, not a 500.
  if (!base || !process.env.DATABASE_URL) return [];
  const entries = await getSitemapEntries();
  return entries.map(({ path, lastModified }) => ({ url: new URL(path, base).href, lastModified }));
}
