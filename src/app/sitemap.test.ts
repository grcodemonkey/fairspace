// @vitest-environment node
import { afterEach, expect, test, vi } from "vitest";
import { getNewsPage } from "@/news";
import sitemap from "./sitemap";

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/sitemap", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/sitemap")>()),
  getSitemapEntries: async () => [],
}));
vi.mock("@/news", () => ({ getNewsPage: vi.fn() }));

afterEach(() => vi.unstubAllEnvs());

test("sitemap-news-index-only-with-posts", async () => {
  vi.stubEnv("AUTH_URL", "https://example.org");
  vi.stubEnv("DATABASE_URL", "postgres://unused");
  const publishedAt = new Date("2026-11-20T00:00:00Z");
  vi.mocked(getNewsPage).mockResolvedValueOnce({ posts: [], hasOlder: false });
  expect(await sitemap()).toEqual([]);
  vi.mocked(getNewsPage).mockResolvedValueOnce({
    posts: [{ slug: "p", title: "P", description: "", image: null, publishedAt }],
    hasOlder: false,
  });
  expect(await sitemap()).toEqual([{ url: "https://example.org/news", lastModified: publishedAt }]);
});
