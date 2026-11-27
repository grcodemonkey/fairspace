import { expect, test, vi } from "vitest";
import { pageMetadata } from "./seo";

const base = { path: "/about", image: null, siteUrl: "https://example.org", siteName: "Riverside", defaultDescription: null };

test("og-title-plain-with-site-name", () => {
  expect(pageMetadata({ ...base, props: { title: "About" } }).openGraph).toMatchObject({ title: "About", siteName: "Riverside" });
});

test("home-canonical-is-root", () => {
  expect(pageMetadata({ ...base, path: "/", props: {} }).alternates?.canonical).toBe("/");
  expect(pageMetadata({ ...base, props: {} }).alternates?.canonical).toBe("/about");
});

test("noindex-sets-robots", () => {
  expect(pageMetadata({ ...base, props: { noindex: true } }).robots).toEqual({ index: false });
  expect(pageMetadata({ ...base, props: { noindex: false } }).robots).toBeUndefined();
});

test("empty-description-omitted", () => {
  const meta = pageMetadata({ ...base, props: { title: "T", description: "  " } });
  expect(meta).not.toHaveProperty("description");
  expect(meta.openGraph).not.toHaveProperty("description");
});

test("bad-site-url-no-metadata-base", () => {
  expect(pageMetadata({ ...base, siteUrl: "not a url", props: {} })).not.toHaveProperty("metadataBase");
  expect(pageMetadata({ ...base, siteUrl: undefined, props: {} })).not.toHaveProperty("metadataBase");
  expect(String(pageMetadata({ ...base, props: {} }).metadataBase)).toBe("https://example.org/");
});

test("image-alt-empty-has-no-alt-key", () => {
  const meta = pageMetadata({ ...base, props: {}, image: { url: "/media/x.png", alt: "" } });
  expect(meta.openGraph).toMatchObject({ images: [{ url: "/media/x.png" }] });
  expect(JSON.stringify(meta.openGraph)).not.toContain("alt");
});

test("default-description-fills-empty", () => {
  const meta = pageMetadata({ ...base, defaultDescription: "Site wide", props: { description: " " } });
  expect(meta.description).toBe("Site wide");
  expect(meta.openGraph).toMatchObject({ description: "Site wide" });
  expect(pageMetadata({ ...base, defaultDescription: "Site wide", props: { description: "Own" } }).description).toBe("Own");
});

test("post-article-meta", () => {
  const publishedTime = new Date("2026-11-20T00:00:00Z");
  const meta = pageMetadata({ ...base, path: "/news/x", publishedTime, props: {} });
  expect(meta.alternates?.canonical).toBe("/news/x");
  expect(meta.openGraph).toMatchObject({ type: "article", url: "/news/x", publishedTime: "2026-11-20T00:00:00.000Z" });
  expect(pageMetadata({ ...base, props: {} }).openGraph).toMatchObject({ type: "website" });
});

test("vercel-production-url-gives-absolute-base", async () => {
  vi.stubEnv("AUTH_URL", "");
  vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "fairspace-demo.vercel.app");
  const { siteUrl } = await import("@/sitemap");
  const meta = pageMetadata({ ...base, siteUrl: siteUrl()?.href, props: {} });
  expect(String(meta.metadataBase)).toBe("https://fairspace-demo.vercel.app/");
  vi.unstubAllEnvs();
});
