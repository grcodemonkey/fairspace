// @vitest-environment node
import { asc, eq, inArray, sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import type { Session } from "next-auth";
import { afterAll, beforeEach, expect, test, vi } from "vitest";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { pageRevisions, pages, users } from "@/db/schema";
import { allBlocksFixture } from "@/puck/all-blocks.fixture";
import { getPublishedPage, pageTag } from "@/puck/published";
import { createPage, publishPage, restoreRevision, saveDraft, setPostDate, unpublishPage } from "./actions";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
// updateTag and refresh work only inside a Next server action; "use cache" is a no-op outside Next.
vi.mock("next/cache", () => ({ updateTag: vi.fn(), refresh: vi.fn(), cacheLife: vi.fn(), cacheTag: vi.fn() }));
// next build sets this from experimental.authInterrupts; without it forbidden() throws a plain Error.
vi.stubEnv("__NEXT_EXPERIMENTAL_AUTH_INTERRUPTS", "true");

// Digest formats from next/dist/client/components/redirect.js and http-access-fallback.
const REDIRECT_TO_SIGN_IN = /^NEXT_REDIRECT;\w+;\/sign-in;307;$/;
const REDIRECT_TO_EDITOR = /^NEXT_REDIRECT;\w+;\/admin\/pages\/[\w-]+\/edit;307;$/;
const NOT_FOUND = "NEXT_HTTP_ERROR_FALLBACK;404";

const run = crypto.randomUUID().slice(0, 8);
const editorId = `actions-editor-${run}`;
const adminId = `actions-admin-${run}`;
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
const signedInAsAdmin = () =>
  vi
    .mocked(auth as () => Promise<Session | null>)
    .mockResolvedValue({ user: { id: adminId, email: `${adminId}@example.com`, role: "admin" }, expires: "" });

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
  vi.mocked(updateTag).mockClear();
  await getDb()
    .insert(users)
    .values([
      { id: editorId, email: `${editorId}@example.com` },
      { id: adminId, email: `${adminId}@example.com`, role: "admin" },
    ])
    .onConflictDoNothing();
});

afterAll(async () => {
  await getDb().delete(pages).where(inArray(pages.slug, slugs)); // cascades to page_revisions
  await getDb().delete(users).where(inArray(users.id, [editorId, adminId]));
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

test("save-draft-unsafe-link-message", async () => {
  signedInAsEditor();
  const page = await insertPage("unsafe-link");
  const bad = {
    root: { props: { title: "Changed" } },
    content: [{ type: "Button", props: { id: "b", label: "Go", href: "javascript:alert(1)", variant: "primary" } }],
  };
  await expect(saveDraft(page.id, bad)).resolves.toEqual({
    error: "A Button link must start with https://, http://, mailto:, tel:, / or #.",
  });
  expect(await reload(page.id)).toEqual(page);
});

test("save-draft-sanitizes-rich-text", async () => {
  signedInAsEditor();
  const page = await insertPage("rich-text");
  const data = allBlocksFixture();
  data.content[2].props.body = '<p>Hi<script>alert(1)</script><img src=x onerror="alert(1)"></p>';
  await expect(saveDraft(page.id, data)).resolves.toEqual({ ok: true });
  const stored = JSON.stringify((await reload(page.id)).draft);
  expect(stored).toContain("<p>Hi</p>");
  expect(stored).not.toMatch(/script|onerror|alert/i);
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

const FORBIDDEN = "NEXT_HTTP_ERROR_FALLBACK;403";
const doc = (title: string) => ({ root: { props: { title } }, content: [] });
const revisionsOf = (pageId: string) =>
  getDb().select().from(pageRevisions).where(eq(pageRevisions.pageId, pageId)).orderBy(asc(pageRevisions.createdAt));
const restoreForm = (pageId: string, revisionId: string) => {
  const f = new FormData();
  f.set("pageId", pageId);
  f.set("revisionId", revisionId);
  return f;
};
const idForm = (id: string) => {
  const f = new FormData();
  f.set("id", id);
  return f;
};

test("publish-signed-out-redirects", async () => {
  const page = await insertPage("pub-signed-out");
  await expect(publishPage(page.id, doc("Live"))).rejects.toMatchObject({
    digest: expect.stringMatching(REDIRECT_TO_SIGN_IN),
  });
  expect(await revisionsOf(page.id)).toHaveLength(0);
  expect(await reload(page.id)).toEqual(page);
});

test("publish-invalid-data-rejected", async () => {
  signedInAsEditor();
  const page = await insertPage("pub-invalid");
  const bad = { root: { props: {} }, content: [{ type: "Script", props: { id: "x" } }] };
  await expect(publishPage(page.id, bad)).resolves.toEqual({ error: "The page data is not valid." });
  expect(await revisionsOf(page.id)).toHaveLength(0);
  expect(await reload(page.id)).toEqual(page);
  expect(updateTag).not.toHaveBeenCalled();
});

test("publish-home-first-time-invalidates", async () => {
  signedInAsEditor();
  // `home` is unique: reuse the test DB's row if another test made one, and delete it only if this test made it.
  const [created] = await getDb()
    .insert(pages)
    .values({ title: "Home", slug: "home", draft: doc("Home") })
    .onConflictDoNothing()
    .returning();
  const [home] = await getDb().select().from(pages).where(eq(pages.slug, "home"));
  try {
    await getDb().update(pages).set({ publishedRevisionId: null }).where(eq(pages.id, home.id));
    await expect(publishPage(home.id, doc("Welcome"))).resolves.toEqual({ ok: true });
    expect(updateTag).toHaveBeenCalledWith(pageTag("home"));
  } finally {
    if (created) await getDb().delete(pages).where(eq(pages.id, created.id));
  }
});

test("publish-goes-live", async () => {
  signedInAsEditor();
  const page = await insertPage("pub-live");
  await expect(publishPage(page.id, doc("Live title"))).resolves.toEqual({ ok: true });
  const [revision, ...rest] = await revisionsOf(page.id);
  expect(rest).toHaveLength(0);
  expect(revision).toMatchObject({ data: doc("Live title"), createdBy: editorId });
  const saved = await reload(page.id);
  expect(saved).toMatchObject({ publishedRevisionId: revision.id, draft: doc("Live title"), title: "Live title" });
  expect((await getPublishedPage(page.slug))?.data).toEqual(doc("Live title"));
  expect(updateTag).toHaveBeenCalledWith(pageTag(page.slug));
});

test("publish-twice-keeps-both", async () => {
  signedInAsEditor();
  const page = await insertPage("pub-twice");
  await publishPage(page.id, doc("First"));
  await publishPage(page.id, doc("Second"));
  const revisions = await revisionsOf(page.id);
  expect(revisions.map((r) => r.data)).toEqual([doc("First"), doc("Second")]);
  expect((await reload(page.id)).publishedRevisionId).toBe(revisions[1].id);
});

test("publish-missing-page-not-found", async () => {
  signedInAsEditor();
  await expect(publishPage(crypto.randomUUID(), doc("x"))).rejects.toMatchObject({ digest: NOT_FOUND });
});

test("concurrent-publishes-serialize", async () => {
  signedInAsEditor();
  const page = await insertPage("pub-race");
  await Promise.all([publishPage(page.id, doc("A")), publishPage(page.id, doc("B"))]);
  const revisions = await revisionsOf(page.id);
  expect(revisions).toHaveLength(2);
  // The row lock plus clock_timestamp(): the newest revision is the live one.
  expect((await reload(page.id)).publishedRevisionId).toBe(revisions[1].id);
});

test("restore-editor-forbidden", async () => {
  signedInAsEditor();
  const page = await insertPage("restore-editor");
  await publishPage(page.id, doc("One"));
  await publishPage(page.id, doc("Two"));
  const [first] = await revisionsOf(page.id);
  const before = await reload(page.id);
  await expect(restoreRevision({}, restoreForm(page.id, first.id))).rejects.toMatchObject({ digest: FORBIDDEN });
  expect(await revisionsOf(page.id)).toHaveLength(2);
  expect(await reload(page.id)).toEqual(before);
});

test("restore-admin-copies-revision", async () => {
  signedInAsEditor();
  const page = await insertPage("restore-admin");
  await publishPage(page.id, doc("One"));
  await publishPage(page.id, doc("Two"));
  const [first] = await revisionsOf(page.id);
  signedInAsAdmin();
  vi.mocked(updateTag).mockClear();
  await expect(restoreRevision({}, restoreForm(page.id, first.id))).resolves.toEqual({ message: "Restored" });
  const revisions = await revisionsOf(page.id);
  expect(revisions).toHaveLength(3);
  expect(revisions[2]).toMatchObject({ data: doc("One"), createdBy: adminId });
  expect(await reload(page.id)).toMatchObject({ publishedRevisionId: revisions[2].id, draft: doc("One"), title: "One" });
  expect(updateTag).toHaveBeenCalledWith(pageTag(page.slug));
});

test("restore-live-revision-refused", async () => {
  signedInAsEditor();
  const page = await insertPage("restore-live");
  await publishPage(page.id, doc("One"));
  const [live] = await revisionsOf(page.id);
  const before = await reload(page.id);
  signedInAsAdmin();
  vi.mocked(updateTag).mockClear();
  await expect(restoreRevision({}, restoreForm(page.id, live.id))).resolves.toEqual({
    error: "That revision is already live.",
  });
  expect(await revisionsOf(page.id)).toHaveLength(1);
  expect(await reload(page.id)).toEqual(before);
  expect(updateTag).not.toHaveBeenCalled();
});

test("restore-other-page-refused", async () => {
  signedInAsEditor();
  const page = await insertPage("restore-victim");
  const other = await insertPage("restore-other");
  await publishPage(page.id, doc("Mine"));
  await publishPage(other.id, doc("Theirs"));
  const [theirs] = await revisionsOf(other.id);
  const before = await reload(page.id);
  signedInAsAdmin();
  vi.mocked(updateTag).mockClear();
  await expect(restoreRevision({}, restoreForm(page.id, theirs.id))).resolves.toEqual({
    error: "That revision is not part of this page.",
  });
  expect(await revisionsOf(page.id)).toHaveLength(1);
  expect(await reload(page.id)).toEqual(before);
  expect(updateTag).not.toHaveBeenCalled();
});

test("restore-invalid-old-data-refused", async () => {
  const page = await insertPage("restore-invalid");
  // A block type that today's validator does not know.
  const [old] = await getDb()
    .insert(pageRevisions)
    .values({ pageId: page.id, data: { root: { props: {} }, content: [{ type: "Gone", props: { id: "g" } }] } })
    .returning();
  signedInAsAdmin();
  await expect(restoreRevision({}, restoreForm(page.id, old.id))).resolves.toEqual({
    error: "The page data is not valid.",
  });
  expect(await revisionsOf(page.id)).toHaveLength(1);
  expect(await reload(page.id)).toEqual(page);
  expect(updateTag).not.toHaveBeenCalled();
});

test("unpublish-takes-page-offline", async () => {
  signedInAsEditor();
  const page = await insertPage("unpublish");
  await publishPage(page.id, doc("Live"));
  vi.mocked(updateTag).mockClear();
  await expect(unpublishPage({}, idForm(page.id))).resolves.toEqual({});
  expect((await reload(page.id)).publishedRevisionId).toBeNull();
  expect(await getPublishedPage(page.slug)).toBeNull();
  expect(await revisionsOf(page.id)).toHaveLength(1);
  expect(updateTag).toHaveBeenCalledWith(pageTag(page.slug));
});

test("unpublish-signed-out-redirects", async () => {
  const page = await insertPage("unpublish-signed-out");
  await expect(unpublishPage({}, idForm(page.id))).rejects.toMatchObject({
    digest: expect.stringMatching(REDIRECT_TO_SIGN_IN),
  });
  expect(await reload(page.id)).toEqual(page);
});

const postForm = (title: string, slug: string, kind = "post") => {
  const f = form(title, slug);
  f.set("kind", kind);
  return f;
};
async function insertPost(name: string) {
  const [row] = await getDb()
    .insert(pages)
    .values({ kind: "post", title: name, slug: slug(name), draft: doc(name) })
    .returning();
  return row;
}
const dateForm = (id: string, date: string) => {
  const f = idForm(id);
  f.set("date", date);
  return f;
};

test("create-post-kind", async () => {
  signedInAsEditor();
  const s = slug("new-post");
  await expect(createPage({}, postForm("News", s))).rejects.toMatchObject({ digest: expect.stringMatching(REDIRECT_TO_EDITOR) });
  expect((await getDb().select().from(pages).where(eq(pages.slug, s)))[0]).toMatchObject({ kind: "post", publishedAt: null });
  const bad = slug("bad-kind");
  await expect(createPage({}, postForm("x", bad, "event"))).resolves.toMatchObject({ error: "Invalid request." });
  expect(await getDb().select().from(pages).where(eq(pages.slug, bad))).toHaveLength(0);
});

test("news-slug-reserved", async () => {
  signedInAsEditor();
  await expect(createPage({}, form("News", "news"))).resolves.toMatchObject({ error: "That slug is reserved." });
  await expect(createPage({}, postForm("News", "news"))).resolves.toMatchObject({ error: "That slug is reserved." });
  await expect(createPage({}, postForm("Home", "home"))).resolves.toMatchObject({ error: "That slug is reserved." });
});

test("slug-shared-namespace", async () => {
  signedInAsEditor();
  const page = await insertPage("shared");
  await expect(createPage({}, postForm("Post", page.slug))).resolves.toMatchObject({ error: "That slug is in use." });
});

test("publish-date-first-only", async () => {
  signedInAsEditor();
  const post = await insertPost("first-date");
  await publishPage(post.id, doc("One"));
  const first = (await reload(post.id)).publishedAt;
  expect(first).toBeInstanceOf(Date);
  await publishPage(post.id, doc("Two"));
  expect((await reload(post.id)).publishedAt).toEqual(first);
  const [one] = await revisionsOf(post.id);
  signedInAsAdmin();
  await expect(restoreRevision({}, restoreForm(post.id, one.id))).resolves.toEqual({ message: "Restored" });
  expect((await reload(post.id)).publishedAt).toEqual(first);
  await unpublishPage({}, idForm(post.id));
  expect((await reload(post.id)).publishedAt).toEqual(first);
});

test("set-post-date", async () => {
  const post = await insertPost("set-date");
  await expect(setPostDate({}, dateForm(post.id, "2026-01-15"))).rejects.toMatchObject({
    digest: expect.stringMatching(REDIRECT_TO_SIGN_IN),
  });
  signedInAsEditor();
  await expect(setPostDate({}, dateForm(post.id, "2026-01-15"))).resolves.toEqual({ message: "Saved" });
  expect((await reload(post.id)).publishedAt).toEqual(new Date("2026-01-15T00:00:00Z"));
  expect(updateTag).toHaveBeenCalledWith(pageTag(post.slug));
  const today = new Date().toISOString().slice(0, 10);
  await expect(setPostDate({}, dateForm(post.id, today))).resolves.toEqual({ message: "Saved" });
  expect((await reload(post.id)).publishedAt).toEqual(new Date(`${today}T00:00:00Z`));
  await setPostDate({}, dateForm(post.id, "2026-01-15"));
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  await expect(setPostDate({}, dateForm(post.id, tomorrow))).resolves.toEqual({ error: "The date cannot be after today." });
  for (const bad of ["2026-02-30", "15/01/2026", ""])
    await expect(setPostDate({}, dateForm(post.id, bad))).resolves.toEqual({ error: "Enter a valid date." });
  const page = await insertPage("not-a-post");
  await expect(setPostDate({}, dateForm(page.id, "2026-01-15"))).resolves.toEqual({
    error: "Only a news post has a publish date.",
  });
  expect((await reload(page.id)).publishedAt).toBeNull();
  expect((await reload(post.id)).publishedAt).toEqual(new Date("2026-01-15T00:00:00Z"));
});
