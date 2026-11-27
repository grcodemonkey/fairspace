"use server";

import { refresh } from "next/cache";
import { contrastRatio, DARK_BG, HEX, isFontKey, LIGHT_BG, MIN_CONTRAST, SITE_NAME_MAX } from "@/brand";
import { requireAdmin } from "@/guards";
import { isImage, UUID } from "@/media";
import { getServableMedia } from "@/media-library";
import { SEO_DESCRIPTION_MAX } from "@/puck/seo";
import { saveSiteSettings } from "@/site-settings";

const UUID_FORMAT = new RegExp(`^${UUID}$`);

export type ActionState = { error?: string; message?: string };

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
};

/** Admins only. Every value is checked here; the hex colors reach CSS, so nothing else gets through. */
export async function saveBrandAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAdmin();

  const siteName = text(formData, "siteName");
  if (!siteName || siteName.length > SITE_NAME_MAX) {
    return { error: `Enter a site name of 1 to ${SITE_NAME_MAX} characters.` };
  }

  const colors = [
    { key: "primaryLight", label: "light", background: LIGHT_BG },
    { key: "primaryDark", label: "dark", background: DARK_BG },
  ] as const;
  const values: Record<(typeof colors)[number]["key"], string> = { primaryLight: "", primaryDark: "" };
  for (const { key, label, background } of colors) {
    const hex = text(formData, key).toLowerCase();
    if (!HEX.test(hex)) return { error: `The ${label} primary color must be a color like #1d4ed8.` };
    const ratio = contrastRatio(hex, background);
    if (ratio < MIN_CONTRAST) {
      return {
        error: `The ${label} primary color has ${ratio.toFixed(1)}:1 contrast on the ${label} background, needs ${MIN_CONTRAST}:1.`,
      };
    }
    values[key] = hex;
  }

  const font = text(formData, "font");
  if (!isFontKey(font)) return { error: "Choose a font from the list." };

  const logoId = text(formData, "logoId");
  if (logoId) {
    const file = await getServableMedia(logoId);
    if (!file || !isImage(file.contentType)) return { error: "The logo must be an image from the media library." };
  }

  await saveSiteSettings({ siteName, logoMediaId: logoId || null, ...values, font }, user.id!);
  refresh();
  return { message: "Saved." };
}

/** Admins only. The default description has the page cap; the share image must be a finished image (a bad id is refused, not stored). */
export async function saveSeoAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAdmin();

  const defaultDescription = text(formData, "defaultDescription");
  if (defaultDescription.length > SEO_DESCRIPTION_MAX) {
    return { error: `The default description can be at most ${SEO_DESCRIPTION_MAX} characters.` };
  }

  const imageId = text(formData, "defaultShareImageId");
  if (imageId) {
    const file = UUID_FORMAT.test(imageId) ? await getServableMedia(imageId) : undefined;
    if (!file || !isImage(file.contentType)) {
      return { error: "The default share image must be an image from the media library." };
    }
  }

  await saveSiteSettings({ defaultDescription: defaultDescription || null, defaultShareImageId: imageId || null }, user.id!);
  refresh();
  return { message: "Saved." };
}
