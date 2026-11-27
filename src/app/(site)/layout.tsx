import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { BRAND_DEFAULTS, FONTS, onColor, safeHex } from "@/brand";
import { getSiteSettings } from "@/site-settings";
import { SiteMenu } from "./site-menu";

export async function generateMetadata(): Promise<Metadata> {
  const { siteName, defaultDescription, defaultShareImage } = await getSiteSettings();
  return {
    title: { default: siteName, template: `%s · ${siteName}` },
    // Used only when the page returns {} (the welcome page): page metadata replaces `description` and
    // `openGraph` as a whole, so pageMetadata applies the same defaults itself.
    ...(defaultDescription && { description: defaultDescription }),
    openGraph: {
      siteName,
      ...(defaultDescription && { description: defaultDescription }),
      ...(defaultShareImage && {
        images: [{ url: defaultShareImage.url, ...(defaultShareImage.alt && { alt: defaultShareImage.alt }) }],
      }),
    },
  };
}

// The public theme shell: brand (#18) and menu (#19).
export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const settings = await getSiteSettings();
  // Second check at render (after the action and the DB constraint): only a 6-digit hex reaches CSS.
  const light = safeHex(settings.primaryLight, BRAND_DEFAULTS.primaryLight);
  const dark = safeHex(settings.primaryDark, BRAND_DEFAULTS.primaryDark);
  // A style object, never a <style> string: React sets each value as one custom property. globals.css maps them.
  const brand = {
    "--brand-primary-light": light,
    "--brand-on-primary-light": onColor(light),
    "--brand-primary-dark": dark,
    "--brand-on-primary-dark": onColor(dark),
    "--brand-font": (FONTS[settings.font] ?? FONTS.geist).stack,
  } as CSSProperties;

  return (
    <div className="brand flex flex-1 flex-col" style={brand}>
      <header className="border-b px-8 py-4 flex flex-wrap items-center justify-between gap-x-8">
        <Link href="/" className="text-lg font-semibold">
          {settings.logo ? (
            // The logo is the link's only content, so its alt is the site name.
            <Image src={settings.logo.url} alt={settings.siteName} width={160} height={40} className="h-10 w-auto" />
          ) : (
            settings.siteName
          )}
        </Link>
        <SiteMenu />
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t px-8 py-4 text-sm text-gray-500">Built with Fairspace</footer>
    </div>
  );
}
