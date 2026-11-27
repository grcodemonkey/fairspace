import { Render } from "@puckeditor/core";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getMediaMeta } from "@/media-library";
import { pageConfig } from "@/puck/config";
import { pageMetadata } from "@/puck/seo";
import { getPublishedPage } from "@/puck/published";
import { SLUG_FORMAT } from "@/puck/slug";
import { getSiteSettings } from "@/site-settings";

// Each slug renders once as a static prerender, so notFound() gives a real 404 status.
export const ensureStatic = "navigation";

// ensureStatic needs one param set; `_` fails SLUG_FORMAT, so the build never queries the DB.
export function generateStaticParams() {
  return [{ slug: ["_"] }];
}

// `/` is the page with slug `home`. Anything other than one valid segment is not a page.
export function resolveSlug(slug: string[] | undefined): string | null {
  if (!slug) return "home";
  return slug.length === 1 && SLUG_FORMAT.test(slug[0]) ? slug[0] : null;
}

type Props = PageProps<"/[[...slug]]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = resolveSlug((await params).slug);
  const data = slug ? await getPublishedPage(slug) : null;
  if (!slug || !data) return {};
  // The published root props only: pages.title follows the draft.
  const props = data.root.props as Record<string, unknown> | undefined;
  const socialImage = props?.socialImage;
  const settings = await getSiteSettings();
  return pageMetadata({
    props,
    slug,
    image: (typeof socialImage === "string" ? await getMediaMeta(socialImage) : null) ?? settings.defaultShareImage,
    siteName: settings.siteName,
    defaultDescription: settings.defaultDescription,
    siteUrl: process.env.AUTH_URL, // static prerender: baked at build, so AUTH_URL must be set at build time too
  });
}

export default async function PublicPage({ params }: Props) {
  const segments = (await params).slug;
  const slug = resolveSlug(segments);
  if (!slug) notFound();
  if (segments?.[0] === "home") permanentRedirect("/");

  const data = await getPublishedPage(slug);
  if (data) return <Render config={pageConfig} data={data} />;
  if (slug !== "home") notFound();

  // A new install has no published home page yet.
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">Fairspace</h1>
      <p>An open-source site builder for nonprofits.</p>
    </div>
  );
}
