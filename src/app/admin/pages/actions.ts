"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/db";
import { pageRevisions, pages } from "@/db/schema";
import { requireAdmin, requireUser } from "@/guards";
import { goLive, invalidatePage, lockPage } from "@/puck/publish";
import { normalizeSlug, RESERVED_SLUGS, SLUG_FORMAT } from "@/puck/slug";
import { PageDataError, parsePageData } from "@/puck/validate";

// The typed values come back with the error: React resets the form after an action.
export type CreatePageState = { error?: string; title?: string; slug?: string };

// Drizzle wraps the driver error, so the Postgres code is on `cause`.
const isUniqueViolation = (error: unknown) =>
  (error as { cause?: { code?: string } })?.cause?.code === "23505" || (error as { code?: string })?.code === "23505";

export async function createPage(_prev: CreatePageState, formData: FormData): Promise<CreatePageState> {
  const user = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  const slug = normalizeSlug(String(formData.get("slug") ?? ""));
  const fail = (error: string) => ({ error, title, slug });
  if (!title) return fail("Enter a title.");
  if (!SLUG_FORMAT.test(slug)) return fail("Use lower-case letters, numbers and single dashes in the slug.");
  if (RESERVED_SLUGS.includes(slug)) return fail("That slug is reserved.");

  let id: string;
  try {
    [{ id }] = await getDb()
      .insert(pages)
      .values({ title, slug, draft: { root: { props: { title } }, content: [] }, updatedBy: user.id ?? null })
      .returning({ id: pages.id });
  } catch (error) {
    if (isUniqueViolation(error)) return fail("That slug is in use.");
    throw error;
  }
  // Outside the try: redirect() throws to do its work.
  redirect(`/admin/pages/${id}/edit`);
}

const dataError = (error: unknown) =>
  error instanceof PageDataError ? error.message : "The page data is not valid.";

/** Saves the draft only. It never touches page_revisions or publishedRevisionId, so the live page stays the same. */
export async function saveDraft(id: string, data: unknown): Promise<{ ok: true } | { error: string }> {
  const user = await requireUser();
  if (typeof id !== "string") return { error: "The page id is not valid." };
  let draft;
  try {
    draft = parsePageData(data);
  } catch (error) {
    return { error: dataError(error) };
  }
  // The root Title field is the source of the page title, so the list never shows a stale one.
  const title = typeof draft.root.props?.title === "string" ? draft.root.props.title.trim() : "";
  const rows = await getDb()
    .update(pages)
    .set({ draft, ...(title && { title }), updatedAt: new Date(), updatedBy: user.id ?? null })
    .where(eq(pages.id, id))
    .returning({ id: pages.id });
  if (rows.length === 0) notFound();
  return { ok: true };
}

export type PublishState = { error?: string };

const field = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" && value ? value : null;
};

/** Saves the editor's current data as the draft and makes it live, in one transaction. Editors and admins. */
export async function publishPage(id: string, data: unknown): Promise<{ ok: true } | { error: string }> {
  const user = await requireUser();
  if (typeof id !== "string") return { error: "The page id is not valid." };
  let parsed;
  try {
    parsed = parsePageData(data);
  } catch (error) {
    return { error: dataError(error) };
  }
  const slug = await getDb().transaction(async (tx) => {
    const page = await lockPage(tx, id);
    if (page) await goLive(tx, page.id, parsed, user.id ?? null);
    return page?.slug;
  });
  if (!slug) notFound();
  invalidatePage(slug); // after the commit, so the next request reads the new revision
  return { ok: true };
}

/** Copies an old revision into a new live revision and the draft. The history stays append-only. Admins only. */
export async function restoreRevision(_prev: PublishState, formData: FormData): Promise<PublishState> {
  const user = await requireAdmin();
  const pageId = field(formData, "pageId");
  const revisionId = field(formData, "revisionId");
  if (!pageId || !revisionId) return { error: "Invalid request." };
  const result = await getDb().transaction(async (tx) => {
    const page = await lockPage(tx, pageId);
    if (!page) return null;
    const [revision] = await tx
      .select({ data: pageRevisions.data })
      .from(pageRevisions)
      .where(and(eq(pageRevisions.id, revisionId), eq(pageRevisions.pageId, pageId)));
    if (!revision) return { error: "That revision is not part of this page." };
    let data;
    try {
      // An old revision can use a block that today's validator refuses.
      data = parsePageData(revision.data);
    } catch (error) {
      return { error: dataError(error) };
    }
    await goLive(tx, page.id, data, user.id ?? null);
    return { slug: page.slug };
  });
  if (!result) notFound();
  if ("error" in result) return result;
  invalidatePage(result.slug);
  refresh();
  return {};
}

/** Takes the page off the site. The draft and the revisions stay. Editors and admins. */
export async function unpublishPage(_prev: PublishState, formData: FormData): Promise<PublishState> {
  const user = await requireUser();
  const id = field(formData, "id");
  if (!id) return { error: "Invalid request." };
  const slug = await getDb().transaction(async (tx) => {
    const page = await lockPage(tx, id);
    if (page) {
      await tx
        .update(pages)
        .set({ publishedRevisionId: null, updatedAt: new Date(), updatedBy: user.id ?? null })
        .where(eq(pages.id, id));
    }
    return page?.slug;
  });
  if (!slug) notFound();
  invalidatePage(slug);
  refresh();
  return {};
}
