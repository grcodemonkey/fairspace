// Server only: the site settings row (one row, id = 1). #16 and #20 add columns and read through here.
import { and, eq, isNotNull, like } from "drizzle-orm";
import { cacheLife, cacheTag, updateTag } from "next/cache";
import { BRAND_DEFAULTS, type FontKey, isFontKey, safeHex } from "@/brand";
import { getDb } from "@/db";
import { media, siteSettings } from "@/db/schema";
import { mediaUrl } from "@/media";

export const SITE_SETTINGS_TAG = "site-settings";

export type SiteSettings = {
  siteName: string;
  logo: { id: string; url: string } | null;
  primaryLight: string;
  primaryDark: string;
  font: FontKey;
};

const DEFAULTS: SiteSettings = { ...BRAND_DEFAULTS, logo: null };

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
  const [row] = await getDb()
    .select({ settings: siteSettings, logo: { id: media.id, contentType: media.contentType } })
    .from(siteSettings)
    // Only a finished image is a logo; anything else falls back to the site name as text.
    .leftJoin(
      media,
      and(eq(media.id, siteSettings.logoMediaId), isNotNull(media.uploadedAt), like(media.contentType, "image/%")),
    )
    .where(eq(siteSettings.id, 1));
  if (!row) return DEFAULTS;
  const s = row.settings;
  return {
    siteName: s.siteName || DEFAULTS.siteName,
    logo: row.logo ? { id: row.logo.id, url: mediaUrl(row.logo) } : null,
    primaryLight: safeHex(s.primaryLight, DEFAULTS.primaryLight),
    primaryDark: safeHex(s.primaryDark, DEFAULTS.primaryDark),
    font: isFontKey(s.font) ? s.font : DEFAULTS.font,
  };
}

type Editable = Partial<Pick<typeof siteSettings.$inferInsert, "siteName" | "logoMediaId" | "primaryLight" | "primaryDark" | "font">>;

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

/** True when the media file is the site logo: the media delete action refuses it. */
export async function isSiteLogo(mediaId: string) {
  const [row] = await getDb()
    .select({ id: siteSettings.id })
    .from(siteSettings)
    .where(eq(siteSettings.logoMediaId, mediaId));
  return Boolean(row);
}
