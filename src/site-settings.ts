// Server only: the site settings row (one row, id = 1). #16 and #20 added columns and read through here.
import { and, eq, isNotNull, like, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { cacheLife, cacheTag, updateTag } from "next/cache";
import { type Analytics, validAnalytics } from "@/analytics";
import { BRAND_DEFAULTS, type FontKey, isFontKey, safeHex } from "@/brand";
import { getDb } from "@/db";
import { media, siteSettings } from "@/db/schema";
import { mediaUrl } from "@/media";
import { mediaTag } from "@/media-library";

export const SITE_SETTINGS_TAG = "site-settings";

export type SiteSettings = {
  siteName: string;
  logo: { id: string; url: string } | null;
  primaryLight: string;
  primaryDark: string;
  font: FontKey;
  defaultDescription: string | null;
  defaultShareImage: { id: string; url: string; alt: string | null } | null;
  analytics: Analytics | null;
};

const DEFAULTS: SiteSettings = {
  ...BRAND_DEFAULTS,
  logo: null,
  defaultDescription: null,
  defaultShareImage: null,
  analytics: null,
};

/** The settings with defaults for unset columns. Every page in the site layout reads it, so it is cached until a save. */
export async function getSiteSettings(): Promise<SiteSettings> {
  // Outside "use cache": `pnpm build` prerenders through the site layout with no database, and these
  // defaults must not be cached as the real settings.
  if (!process.env.DATABASE_URL) return DEFAULTS;
  return readSiteSettings();
}

async function readSiteSettings(): Promise<SiteSettings> {
  "use cache";
  cacheLife("max");
  cacheTag(SITE_SETTINGS_TAG);
  const share = alias(media, "share");
  const [row] = await getDb()
    .select({
      settings: siteSettings,
      logo: { id: media.id, contentType: media.contentType },
      share: { id: share.id, contentType: share.contentType, alt: share.alt },
    })
    .from(siteSettings)
    // Only a finished image is a logo or share image; anything else is as good as unset.
    .leftJoin(
      media,
      and(eq(media.id, siteSettings.logoMediaId), isNotNull(media.uploadedAt), like(media.contentType, "image/%")),
    )
    .leftJoin(
      share,
      and(eq(share.id, siteSettings.defaultShareImageId), isNotNull(share.uploadedAt), like(share.contentType, "image/%")),
    )
    .where(eq(siteSettings.id, 1));
  if (!row) return DEFAULTS;
  // An alt edit on the default share image must refresh the cached og:image:alt.
  if (row.share) cacheTag(mediaTag(row.share.id));
  const s = row.settings;
  return {
    siteName: s.siteName || DEFAULTS.siteName,
    logo: row.logo ? { id: row.logo.id, url: mediaUrl(row.logo) } : null,
    primaryLight: safeHex(s.primaryLight, DEFAULTS.primaryLight),
    primaryDark: safeHex(s.primaryDark, DEFAULTS.primaryDark),
    font: isFontKey(s.font) ? s.font : DEFAULTS.font,
    defaultDescription: s.defaultDescription?.trim() || null,
    defaultShareImage: row.share ? { id: row.share.id, url: mediaUrl(row.share), alt: row.share.alt } : null,
    // Render-side check, after the action and the DB constraint: only a valid provider and ID reach a script tag.
    analytics: validAnalytics(s.analyticsProvider, s.analyticsId),
  };
}

// Every settings column: a new column (#16, #20) is editable with no change here.
type Editable = Partial<Omit<typeof siteSettings.$inferInsert, "id" | "updatedAt" | "updatedBy">>;

/** Writes only the given columns, so each settings section saves without overwriting the others. Server actions only. */
export async function saveSiteSettings(values: Editable, userId: string) {
  const set = { ...values, updatedAt: new Date(), updatedBy: userId };
  await getDb()
    .insert(siteSettings)
    .values({ id: 1, ...set })
    .onConflictDoUpdate({ target: siteSettings.id, set });
  // The layout's cached read joins every public page's prerender, so this also refreshes those pages.
  updateTag(SITE_SETTINGS_TAG);
}

/** Which site setting uses the media file, or null: the media delete action refuses a file that is in use. */
export async function siteSettingUsing(mediaId: string): Promise<"logo" | "share image" | null> {
  const [row] = await getDb()
    .select({ logo: siteSettings.logoMediaId, share: siteSettings.defaultShareImageId })
    .from(siteSettings)
    .where(or(eq(siteSettings.logoMediaId, mediaId), eq(siteSettings.defaultShareImageId, mediaId)));
  return !row ? null : row.logo === mediaId ? "logo" : "share image";
}
