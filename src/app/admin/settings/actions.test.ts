// @vitest-environment node
// Integration: real test database. The only test file that writes site_settings (one row), so no race.
import { eq, inArray } from "drizzle-orm";
import type { Session } from "next-auth";
import { cacheTag, updateTag } from "next/cache";
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { media, siteSettings, users } from "@/db/schema";
import { mediaTag } from "@/media-library";
import { getSiteSettings, SITE_SETTINGS_TAG } from "@/site-settings";
import { deleteMediaAction } from "../media/actions";
import { saveBrandAction, saveSeoAction } from "./actions";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn(), updateTag: vi.fn(), cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
// next build sets this from experimental.authInterrupts; without it forbidden() throws a plain Error.
vi.stubEnv("__NEXT_EXPERIMENTAL_AUTH_INTERRUPTS", "true");

// The users row is an editor so users.test.ts's admin count stays right; the mocked session says admin.
const admin = { id: crypto.randomUUID(), email: `settings-${crypto.randomUUID()}@example.com`, role: "admin" as const };
const logo = crypto.randomUUID();
const pdf = crypto.randomUUID();

const signedInAs = (role: "admin" | "editor") =>
  vi.mocked(auth as () => Promise<Session | null>).mockResolvedValue({ user: { ...admin, role }, expires: "" });

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};
const brand = { siteName: "Riverside Food Bank", primaryLight: "#047857", primaryDark: "#34d399", font: "serif" };
const valid = { ...brand, logoId: "" };
const rows = () => getDb().select().from(siteSettings);

beforeAll(async () => {
  await getDb().insert(users).values({ ...admin, role: "editor" });
  const uploadedAt = new Date();
  await getDb()
    .insert(media)
    .values([
      { id: logo, key: `media/${logo}.png`, filename: "logo.png", contentType: "image/png", size: 1, uploadedBy: admin.id, uploadedAt },
      { id: pdf, key: `media/${pdf}.pdf`, filename: "a.pdf", contentType: "application/pdf", size: 1, uploadedBy: admin.id, uploadedAt },
    ]);
});
beforeEach(async () => {
  signedInAs("admin");
  await getDb().delete(siteSettings);
});
afterAll(async () => {
  await getDb().delete(siteSettings);
  await getDb().delete(media).where(inArray(media.id, [logo, pdf]));
  await getDb().delete(users).where(eq(users.id, admin.id));
});

test("brand-admin-only", async () => {
  signedInAs("editor");
  await expect(saveBrandAction({}, form(valid))).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;403" });
  expect(await rows()).toEqual([]);
});

test.each(["red", "#fff", "#12345g", "#1d4ed8;}", "var(--x)", ""])("brand-bad-hex-refused: %s", async (bad) => {
  for (const key of ["primaryLight", "primaryDark"]) {
    expect(await saveBrandAction({}, form({ ...valid, [key]: bad }))).toEqual({
      error: expect.stringMatching(/must be a color like #1d4ed8/),
    });
  }
  expect(await rows()).toEqual([]);
});

test("brand-low-contrast-refused", async () => {
  expect(await saveBrandAction({}, form({ ...valid, primaryLight: "#9ca3af" }))).toEqual({
    error: "The light primary color has 2.5:1 contrast on the light background, needs 4.5:1.",
  });
  expect(await saveBrandAction({}, form({ ...valid, primaryDark: "#1d4ed8" }))).toEqual({
    error: expect.stringMatching(/^The dark primary color has \d\.\d:1 contrast on the dark background, needs 4\.5:1\.$/),
  });
  expect(await rows()).toEqual([]);
});

test("brand-other-fields-refused", async () => {
  expect(await saveBrandAction({}, form({ ...valid, siteName: "  " }))).toMatchObject({ error: expect.any(String) });
  expect(await saveBrandAction({}, form({ ...valid, siteName: "x".repeat(101) }))).toMatchObject({ error: expect.any(String) });
  expect(await saveBrandAction({}, form({ ...valid, font: "Comic Sans; color: red" }))).toEqual({
    error: "Choose a font from the list.",
  });
  expect(await rows()).toEqual([]);
});

test("brand-logo-not-image-refused", async () => {
  const error = "The logo must be an image from the media library.";
  expect(await saveBrandAction({}, form({ ...valid, logoId: pdf }))).toEqual({ error });
  expect(await saveBrandAction({}, form({ ...valid, logoId: crypto.randomUUID() }))).toEqual({ error });
  expect(await rows()).toEqual([]);
});

test("brand-save-upserts", async () => {
  expect(await saveBrandAction({}, form({ ...valid, primaryLight: "#1D4ED8" }))).toEqual({ message: "Saved." });
  expect((await rows())[0].primaryLight).toBe("#1d4ed8"); // lower-cased for the DB check
  expect(await saveBrandAction({}, form({ ...valid, logoId: logo }))).toEqual({ message: "Saved." });
  const saved = await rows();
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ ...brand, logoMediaId: logo, updatedBy: admin.id });
  expect(updateTag).toHaveBeenCalledWith(SITE_SETTINGS_TAG);
  expect(await getSiteSettings()).toEqual({
    siteName: valid.siteName,
    logo: { id: logo, url: `/media/${logo}.png` },
    primaryLight: valid.primaryLight,
    primaryDark: valid.primaryDark,
    font: "serif",
    defaultDescription: null,
    defaultShareImage: null,
  });
});

test("brand-db-refuses-bad-values", async () => {
  // The second line of defense: a write that skips the action still cannot store CSS.
  await expect(getDb().insert(siteSettings).values({ primaryLight: "red;}" })).rejects.toThrow();
  await expect(getDb().insert(siteSettings).values({ font: "comic" })).rejects.toThrow();
  await expect(getDb().insert(siteSettings).values({ id: 2 })).rejects.toThrow();
  await expect(getDb().insert(siteSettings).values({ defaultDescription: "x".repeat(301) })).rejects.toThrow();
});

test("defaults-when-unset", async () => {
  expect(await getSiteSettings()).toEqual({
    siteName: "Fairspace",
    logo: null,
    primaryLight: "#1d4ed8",
    primaryDark: "#60a5fa",
    font: "geist",
    defaultDescription: null,
    defaultShareImage: null,
  });
});

test("logo-delete-refused", async () => {
  await saveBrandAction({}, form({ ...valid, logoId: logo }));
  expect(await deleteMediaAction({}, form({ id: logo }))).toEqual({
    error: "Used as the site logo. Change the logo in Settings first.",
  });
  expect((await getDb().select().from(media).where(eq(media.id, logo))).length).toBe(1);
});

const seo = { defaultDescription: "We feed the river valley.", defaultShareImageId: logo };

test("seo-admin-only", async () => {
  signedInAs("editor");
  await expect(saveSeoAction({}, form(seo))).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;403" });
  expect(await rows()).toEqual([]);
});

test("seo-description-cap", async () => {
  expect(await saveSeoAction({}, form({ ...seo, defaultDescription: "x".repeat(301) }))).toEqual({
    error: "The default description can be at most 300 characters.",
  });
  expect(await rows()).toEqual([]);
  expect(await saveSeoAction({}, form({ ...seo, defaultDescription: "x".repeat(300) }))).toEqual({ message: "Saved." });
});

test("seo-image-not-image-refused", async () => {
  const error = "The default share image must be an image from the media library.";
  for (const bad of [pdf, crypto.randomUUID(), "../x", logo.toUpperCase()]) {
    expect(await saveSeoAction({}, form({ ...seo, defaultShareImageId: bad }))).toEqual({ error });
  }
  expect(await rows()).toEqual([]);
});

test("seo-save-touches-only-its-columns", async () => {
  await saveBrandAction({}, form(valid));
  expect(await saveSeoAction({}, form(seo))).toEqual({ message: "Saved." });
  const [saved] = await rows();
  expect(saved).toMatchObject({ ...brand, ...seo });
  expect(updateTag).toHaveBeenCalledWith(SITE_SETTINGS_TAG);
  expect(await getSiteSettings()).toMatchObject({
    siteName: brand.siteName,
    defaultDescription: seo.defaultDescription,
    defaultShareImage: { id: logo, url: `/media/${logo}.png`, alt: null },
  });
  expect(cacheTag).toHaveBeenCalledWith(mediaTag(logo)); // an alt edit refreshes the cached default image
  // Clearing both stores null; the brand stays.
  await saveSeoAction({}, form({ defaultDescription: "", defaultShareImageId: "" }));
  expect((await rows())[0]).toMatchObject({ ...brand, defaultDescription: null, defaultShareImageId: null });
});

test("seo-first-save-without-brand-keeps-default-name", async () => {
  await saveSeoAction({}, form(seo));
  expect((await getSiteSettings()).siteName).toBe("Fairspace");
});

test("share-image-delete-refused", async () => {
  await saveSeoAction({}, form(seo));
  expect(await deleteMediaAction({}, form({ id: logo }))).toEqual({
    error: "Used as the site share image. Change the share image in Settings first.",
  });
  expect((await getDb().select().from(media).where(eq(media.id, logo))).length).toBe(1);
});
