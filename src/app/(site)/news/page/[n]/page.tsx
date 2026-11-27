import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getNewsPage } from "@/news";
import { feedAlternate } from "@/puck/seo";
import { publicPath } from "@/puck/slug";
import { getSiteSettings } from "@/site-settings";
import { siteUrl } from "@/sitemap";

// `/news` is this route with n = 1 (rewrite in next.config.ts), and `/news/page/1` redirects to `/news`.
// Same static pattern as news/[slug]: each page number renders once, and notFound() gives a real 404.
export const ensureStatic = "navigation";

// `_` fails PAGE_NUMBER, so the build never queries the DB.
export function generateStaticParams() {
  return [{ n: "_" }];
}

// At most 999: each page number is its own cache entry, so a crawler cannot fill the cache with endless numbers.
const PAGE_NUMBER = /^[1-9]\d{0,2}$/;
const pagePath = (n: number) => (n === 1 ? "/news" : `/news/page/${n}`);

type Props = PageProps<"/news/page/[n]">;

async function pageNumber(params: Props["params"]) {
  const { n } = await params;
  return PAGE_NUMBER.test(n) ? Number(n) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const n = await pageNumber(params);
  if (!n) return {};
  const { siteName, defaultDescription } = await getSiteSettings();
  const base = siteUrl();
  return {
    title: n === 1 ? "News" : `News – page ${n}`,
    ...(defaultDescription && { description: defaultDescription }),
    alternates: {
      canonical: pagePath(n),
      types: feedAlternate(siteName),
    },
    // Same origin rule as the feed. Static prerender: read at build, so set AUTH_URL at build time too.
    ...(base && { metadataBase: base }),
  };
}

export default async function NewsIndex({ params }: Props) {
  const n = await pageNumber(params);
  if (!n) notFound();
  const { posts, hasOlder } = await getNewsPage(n);
  if (n > 1 && posts.length === 0) notFound();
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-4xl font-bold">News</h1>
      {posts.length === 0 ? (
        <p className="mt-6">No news yet.</p>
      ) : (
        <ol className="mt-8 space-y-10">
          {posts.map((post) => (
            <li key={post.slug}>
              <article className="flex flex-col gap-4 sm:flex-row-reverse sm:items-start">
                {post.image && (
                  <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded sm:w-56">
                    <Image src={post.image.url} alt={post.image.alt ?? ""} fill sizes="(min-width: 640px) 14rem, 100vw" className="object-cover" />
                  </div>
                )}
                <div className="flex-1">
                  <h2 className="text-2xl font-semibold">
                    <Link href={publicPath("post", post.slug)} className="underline-offset-4 hover:underline">
                      {post.title}
                    </Link>
                  </h2>
                  {/* Same UTC date as the post page. */}
                  <time dateTime={post.publishedAt.toISOString()} className="mt-1 block text-gray-600 dark:text-gray-400">
                    {post.publishedAt.toLocaleDateString("en-US", { dateStyle: "long", timeZone: "UTC" })}
                  </time>
                  {post.description && <p className="mt-2">{post.description}</p>}
                </div>
              </article>
            </li>
          ))}
        </ol>
      )}
      {(n > 1 || hasOlder) && (
        <nav aria-label="News pages" className="mt-10 flex justify-between gap-4">
          {n > 1 ? <Link href={pagePath(n - 1)} className="underline">Newer posts</Link> : <span />}
          {hasOlder && <Link href={pagePath(n + 1)} className="underline">Older posts</Link>}
        </nav>
      )}
    </div>
  );
}
