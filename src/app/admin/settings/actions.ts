"use server";

import { refresh } from "next/cache";
import { contrastRatio, DARK_BG, HEX, isFontKey, LIGHT_BG, MIN_CONTRAST, SITE_NAME_MAX } from "@/brand";
import { requireAdmin } from "@/guards";
import { isImage } from "@/media";
import { getServableMedia } from "@/media-library";
import { saveSiteSettings } from "@/site-settings";

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
