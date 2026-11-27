// @vitest-environment node
import { asc, eq } from "drizzle-orm";
import { updateTag } from "next/cache";
import type { Session } from "next-auth";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { menuItems, pages } from "@/db/schema";
import { MENU_TAG } from "@/menu";
import { saveMenu } from "./actions";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
// updateTag works only inside a Next server action.
vi.mock("next/cache", () => ({ updateTag: vi.fn(), cacheLife: vi.fn(), cacheTag: vi.fn() }));
// next build sets this from experimental.authInterrupts; without it forbidden() throws a plain Error.
vi.stubEnv("__NEXT_EXPERIMENTAL_AUTH_INTERRUPTS", "true");

// The menu is one table for the whole site: this lock keeps this file and src/menu.test.ts apart.
const lock = postgres(process.env.DATABASE_URL!, { max: 1 });
const run = crypto.randomUUID().slice(0, 8);
const slug = `menu-action-${run}`;
let pageId = "";

const signedInAs = (role: "admin" | "editor" | null) =>
  vi
    .mocked(auth as () => Promise<Session | null>)
    .mockResolvedValue(role && { user: { id: `${role}-${run}`, email: `${role}-${run}@example.com`, role }, expires: "" });
const rows = () => getDb().select().from(menuItems).orderBy(asc(menuItems.position));
const menu = [
  { label: "About", pageId: "", url: null, children: [{ label: "Donate", pageId: null, url: "https://example.org" }] },
  { label: "Contact", pageId: null, url: "mailto:hi@example.org", children: [] },
];

beforeAll(async () => {
  await lock`select pg_advisory_lock(19)`;
  [{ id: pageId }] = await getDb()
    .insert(pages)
    .values({ title: "About", slug, draft: { root: { props: {} }, content: [] } })
    .returning();
  menu[0].pageId = pageId;
});
beforeEach(async () => {
  vi.mocked(updateTag).mockClear();
  await getDb().delete(menuItems);
  await getDb().insert(menuItems).values({ position: 0, label: "Old", url: "/old" });
});
afterAll(async () => {
  await getDb().delete(menuItems);
  await getDb().delete(pages).where(eq(pages.id, pageId));
  await lock.end();
});

test("signed-out-redirected", async () => {
  signedInAs(null);
  await expect(saveMenu(menu)).rejects.toMatchObject({ digest: expect.stringMatching(/^NEXT_REDIRECT;\w+;\/sign-in;307;$/) });
  expect(await rows()).toMatchObject([{ label: "Old" }]);
});

test("editor-forbidden", async () => {
  signedInAs("editor");
  await expect(saveMenu(menu)).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;403" });
  expect(await rows()).toMatchObject([{ label: "Old" }]);
  expect(updateTag).not.toHaveBeenCalled();
});

test("admin-save-replaces-menu", async () => {
  signedInAs("admin");
  await expect(saveMenu(menu)).resolves.toEqual({ ok: true });
  const saved = await rows();
  const about = saved.find((row) => row.label === "About")!;
  expect(saved).toHaveLength(3);
  expect(about).toMatchObject({ parentId: null, position: 0, pageId, url: null });
  expect(saved.find((row) => row.label === "Contact")).toMatchObject({ parentId: null, position: 1 });
  expect(saved.find((row) => row.label === "Donate")).toMatchObject({ parentId: about.id, position: 0 });
  // An empty menu is a valid save.
  await expect(saveMenu([])).resolves.toEqual({ ok: true });
  expect(await rows()).toHaveLength(0);
});

test("save-updates-menu-tag", async () => {
  signedInAs("admin");
  await saveMenu(menu);
  expect(updateTag).toHaveBeenCalledWith(MENU_TAG);
});

test("invalid-menu-refused", async () => {
  signedInAs("admin");
  await expect(saveMenu([{ label: "Bad", pageId: null, url: "javascript:alert(1)", children: [] }])).resolves.toEqual({
    error: expect.stringMatching(/must start with/),
  });
  expect(await rows()).toMatchObject([{ label: "Old" }]);
  expect(updateTag).not.toHaveBeenCalled();
});

test("post-item-refused", async () => {
  signedInAs("admin");
  const [post] = await getDb()
    .insert(pages)
    .values({ kind: "post", title: "News", slug: `menu-post-${run}`, draft: { root: { props: {} }, content: [] } })
    .returning();
  try {
    const child = { label: "Post", pageId: post.id, url: null };
    await expect(saveMenu([{ label: "Top", pageId: null, url: "/", children: [child] }])).resolves.toEqual({
      error: "Link a page, or use the post URL.",
    });
    expect(await rows()).toMatchObject([{ label: "Old" }]);
    expect(updateTag).not.toHaveBeenCalled();
  } finally {
    await getDb().delete(pages).where(eq(pages.id, post.id));
  }
});

test("unknown-page-refused", async () => {
  signedInAs("admin");
  await expect(saveMenu([{ label: "Gone", pageId: `no-such-page-${run}`, url: null, children: [] }])).resolves.toEqual({
    error: "A linked page no longer exists.",
  });
  // The transaction rolled back: the old menu stays.
  expect(await rows()).toMatchObject([{ label: "Old" }]);
  expect(updateTag).not.toHaveBeenCalled();
});
