import { connection } from "next/server";
import { buildRss, getNewsPage } from "@/news";
import { getSiteSettings } from "@/site-settings";
import { siteUrl } from "@/sitemap";

// A static segment, so it wins over news/[slug] (and `feed.xml` fails SLUG_FORMAT anyway).
export async function GET() {
  await connection(); // request time: `next build` has no database, and the links need the run-time site URL
  const base = siteUrl();
  // RSS needs absolute links, and the Host header is not trusted. An empty channel would still need a <link>,
  // and readers treat 503 as "try later" and keep the items they have.
  if (!base) return new Response("Feed unavailable: set AUTH_URL.", { status: 503 });
  const [{ posts }, settings] = await Promise.all([getNewsPage(1), getSiteSettings()]);
  const xml = buildRss({
    siteName: settings.siteName,
    description: settings.defaultDescription || `News from ${settings.siteName}`,
    base,
    posts,
  });
  return new Response(xml, {
    // Readers poll often; 5 minutes in shared caches is fresh enough for news.
    headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
}
