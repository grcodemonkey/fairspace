// Brand values and contrast math. Pure: the settings form, the action and the site layout share it.

/** The only color form that reaches CSS: 6-digit lower-case hex. */
export const HEX = /^#[0-9a-f]{6}$/;

/** Page backgrounds. Must match `--background` in globals.css (light and dark). */
export const LIGHT_BG = "#ffffff";
export const DARK_BG = "#0a0a0a";

/** WCAG AA for normal text. */
export const MIN_CONTRAST = 4.5;

/** The font choices. Fixed CSS stacks: no user text reaches font-family. Geist is loaded by the root layout. */
export const FONTS = {
  geist: { label: "Geist", stack: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif" },
  system: { label: "System sans", stack: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  serif: { label: "Serif", stack: 'Georgia, Cambria, "Times New Roman", Times, serif' },
} as const;

export type FontKey = keyof typeof FONTS;

export const isFontKey = (value: unknown): value is FontKey => typeof value === "string" && Object.hasOwn(FONTS, value);

/** The #13 values: what a site shows before an admin saves the brand. */
export const BRAND_DEFAULTS = {
  siteName: "Fairspace",
  primaryLight: "#1d4ed8",
  primaryDark: "#60a5fa",
  font: "geist" as FontKey,
};

export const SITE_NAME_MAX = 100;

// WCAG 2.x relative luminance of a #rrggbb color.
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1 to 21. Both colors must match HEX. */
export function contrastRatio(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Text color on a primary-color button: white or black, whichever has more contrast (always at least 4.58:1). */
export const onColor = (hex: string) => (contrastRatio(hex, "#ffffff") >= contrastRatio(hex, "#000000") ? "#ffffff" : "#000000");

/** The hex if it is safe for CSS, else the fallback. The render-time check (the action and the DB check come first). */
export const safeHex = (value: unknown, fallback: string) => (typeof value === "string" && HEX.test(value) ? value : fallback);
