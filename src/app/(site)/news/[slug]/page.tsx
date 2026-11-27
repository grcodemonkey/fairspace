import { Render } from "@puckeditor/core";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getMediaMeta, resolvePageMedia } from "@/media-library";
import { pageConfig } from "@/puck/config";
import { getPublishedPage, isRedirect } from "@/puck/published";
import { pageMetadata } from "@/puck/seo";
import { siteUrl } from "@/sitemap";
import { publicPath, SLUG_FORMAT } from "@/puck/slug";
import { getSiteSettings } from "@/site-settings";

// Same static pattern as the catch-all page route: each slug renders once, and notFound() gives a real 404.
// `/news` alone is the index (news/page/[n], through a rewrite in next.config.ts).
export const ensureStatic = "navigation";

// `_` fails SLUG_FORMAT, so the build never queries the DB.
export function generateStaticParams() {
  return [{ slug: "_" }];
}

type Props = PageProps<"/news/[slug]">;

async function loadPost(slug: string) {
  return SLUG_FORMAT.test(slug) ? getPublishedPage(slug, "post") : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await loadPost(slug);
  if (!post || isRedirect(post)) return {};
  // The published root props only: pages.title follows the draft.
  const props = post.data.root.props as Record<string, unknown> | undefined;
  const socialImage = props?.socialImage;
  const settings = await getSiteSettings();
  return pageMetadata({
    props,
    path: publicPath("post", slug),
    image: (typeof socialImage === "string" ? await getMediaMeta(socialImage) : null) ?? settings.defaultShareImage,
    publishedTime: post.publishedAt,
    siteName: settings.siteName,
    defaultDescription: settings.defaultDescription,
    siteUrl: siteUrl()?.href, // static prerender: baked at build. AUTH_URL, else the Vercel production URL
  });
}

export default async function NewsPost({ params }: Props) {
  const { slug } = await params;
  const post = await loadPost(slug);
  if (!post) notFound();
  if (isRedirect(post)) permanentRedirect(post.redirectTo);
  const title = post.data.root.props?.title;
  return (
    <article>
      <header className="mx-auto max-w-3xl px-4 pt-8">
        {typeof title === "string" && title.trim() && <h1 className="text-4xl font-bold">{title}</h1>}
        {/* shortcut: dates show in UTC; add a site time zone setting if editors need local dates. */}
        {post.publishedAt && (
          <time dateTime={post.publishedAt.toISOString()} className="block mt-2 text-gray-600">
            {post.publishedAt.toLocaleDateString("en-US", { dateStyle: "long", timeZone: "UTC" })}
          </time>
        )}
      </header>
      <Render config={pageConfig} data={post.data} metadata={{ media: await resolvePageMedia(post.data) }} />
    </article>
  );
}
