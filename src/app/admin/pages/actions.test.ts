// @vitest-environment node
import { eq, inArray, sql } from "drizzle-orm";
import type { Session } from "next-auth";
import { afterAll, beforeEach, expect, test, vi } from "vitest";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { pageRevisions, pages, users } from "@/db/schema";
import { createPage, saveDraft } from "./actions";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

// Digest formats from next/dist/client/components/redirect.js and http-access-fallback.
const REDIRECT_TO_SIGN_IN = /^NEXT_REDIRECT;\w+;\/sign-in;307;$/;
const REDIRECT_TO_EDITOR = /^NEXT_REDIRECT;\w+;\/admin\/pages\/[\w-]+\/edit;307;$/;
const NOT_FOUND = "NEXT_HTTP_ERROR_FALLBACK;404";

const run = crypto.randomUUID().slice(0, 8);
const editorId = `actions-editor-${run}`;
const slugs: string[] = [];
const slug = (name: string) => {
  const s = `${name}-${run}`;
  slugs.push(s);
  return s;
};
const form = (title: string, slug: string) => {
  const f = new FormData();
  f.set("title", title);
  f.set("slug", slug);
  return f;
};

const signedOut = () => vi.mocked(auth as () => Promise<Session | null>).mockResolvedValue(null);
const signedInAsEditor = () =>
  vi
    .mocked(auth as () => Promise<Session | null>)
    .mockResolvedValue({ user: { id: editorId, email: `${editorId}@example.com`, role: "editor" }, expires: "" });

async function insertPage(name: string) {
  const [row] = await getDb()
    .insert(pages)
    .values({ title: name, slug: slug(name), draft: { root: { props: { title: name } }, content: [] } })
    .returning();
  return row;
}
const reload = async (id: string) => (await getDb().select().from(pages).where(eq(pages.id, id)))[0];

beforeEach(async () => {
  signedOut();
  await getDb().insert(users).values({ id: editorId, email: `${editorId}@example.com` }).onConflictDoNothing();
});

afterAll(async () => {
  await getDb().delete(pages).where(inArray(pages.slug, slugs)); // cascades to page_revisions
  await getDb().delete(users).where(eq(users.id, editorId));
});

const newDraft = { root: { props: { title: "Changed" } }, content: [] };

test("save-draft-signed-out-redirects", async () => {
  const page = await insertPage("signed-out");
  await expect(saveDraft(page.id, newDraft)).rejects.toMatchObject({
    digest: expect.stringMatching(REDIRECT_TO_SIGN_IN),
  });
  expect((await reload(page.id)).draft).toEqual(page.draft);
});

test("save-draft-invalid-data-rejected", async () => {
  signedInAsEditor();
  const page = await insertPage("invalid");
  const bad = { root: { props: {} }, content: [{ type: "Script", props: { id: "x" } }] };
  await expect(saveDraft(page.id, bad)).resolves.toEqual({ error: "The page data is not valid." });
  expect(await reload(page.id)).toEqual(page);
});

test("save-draft-editor-saves", async () => {
  signedInAsEditor();
  const page = await insertPage("saves");
  await expect(saveDraft(page.id, newDraft)).resolves.toEqual({ ok: true });
  const saved = await reload(page.id);
  expect(saved.draft).toEqual(newDraft);
  expect(saved.updatedBy).toBe(editorId);
  // A draft save does not change the live page.
  expect(saved.publishedRevisionId).toBeNull();
  const [{ count }] = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(pageRevisions)
    .where(eq(pageRevisions.pageId, page.id));
  expect(count).toBe(0);
});

test("save-draft-updates-page-title", async () => {
  signedInAsEditor();
  const page = await insertPage("title");
  await saveDraft(page.id, { root: { props: { title: "  New title " } }, content: [] });
  expect((await reload(page.id)).title).toBe("New title");
  // An empty root title keeps the old one.
  await saveDraft(page.id, { root: { props: { title: " " } }, content: [] });
  expect((await reload(page.id)).title).toBe("New title");
});

test("save-draft-non-string-id-rejected", async () => {
  signedInAsEditor();
  await expect(saveDraft({ id: 1 } as unknown as string, newDraft)).resolves.toEqual({
    error: "The page id is not valid.",
  });
});

test("save-draft-missing-page-not-found", async () => {
  signedInAsEditor();
  await expect(saveDraft(crypto.randomUUID(), newDraft)).rejects.toMatchObject({ digest: NOT_FOUND });
});

test("create-page-signed-out-redirects", async () => {
  const s = slug("signed-out-create");
  await expect(createPage({}, form("Nope", s))).rejects.toMatchObject({
    digest: expect.stringMatching(REDIRECT_TO_SIGN_IN),
  });
  expect(await getDb().select().from(pages).where(eq(pages.slug, s))).toHaveLength(0);
});

test("create-page-redirects-to-editor", async () => {
  signedInAsEditor();
  const s = slug("created");
  await expect(createPage({}, form("About us", ` ${s.toUpperCase()} `))).rejects.toMatchObject({
    digest: expect.stringMatching(REDIRECT_TO_EDITOR),
  });
  const [row] = await getDb().select().from(pages).where(eq(pages.slug, s));
  expect(row).toMatchObject({ title: "About us", draft: { root: { props: { title: "About us" } }, content: [] } });
});

test("create-page-duplicate-slug-error", async () => {
  signedInAsEditor();
  const page = await insertPage("dupe");
  await expect(createPage({}, form("Again", page.slug))).resolves.toMatchObject({ error: "That slug is in use.", title: "Again", slug: page.slug });
});

test("create-page-reserved-slug-error", async () => {
  signedInAsEditor();
  await expect(createPage({}, form("Admin", "admin"))).resolves.toMatchObject({ error: "That slug is reserved." });
});

test("create-page-bad-slug-error", async () => {
  signedInAsEditor();
  await expect(createPage({}, form("Bad", "a b/c"))).resolves.toMatchObject({ error: expect.any(String) });
});

test("slug-unique-in-db", async () => {
  const page = await insertPage("unique");
  await expect(
    getDb().insert(pages).values({ title: "x", slug: page.slug, draft: newDraft }),
  ).rejects.toMatchObject({ cause: { code: "23505" } });
});
