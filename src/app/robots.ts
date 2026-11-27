import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { siteUrl } from "@/sitemap";

// Disallow is a crawl hint, not a guard: the sign-in and role checks stay.
export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection(); // request time: AUTH_URL is read at run time
  const base = siteUrl();
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/sign-in"] },
    ...(base && { sitemap: new URL("/sitemap.xml", base).href }),
  };
}
