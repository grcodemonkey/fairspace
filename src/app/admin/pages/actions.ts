"use server";

import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/db";
import { pages } from "@/db/schema";
import { requireUser } from "@/guards";
import { normalizeSlug, RESERVED_SLUGS, SLUG_FORMAT } from "@/puck/slug";
import { parsePageData } from "@/puck/validate";

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

/** Saves the draft only. It never touches page_revisions or publishedRevisionId, so the live page stays the same. */
export async function saveDraft(id: string, data: unknown): Promise<{ ok: true } | { error: string }> {
  const user = await requireUser();
  let draft;
  try {
    draft = parsePageData(data);
  } catch {
    return { error: "The page data is not valid." };
  }
  const rows = await getDb()
    .update(pages)
    .set({ draft, updatedAt: new Date(), updatedBy: user.id ?? null })
    .where(eq(pages.id, String(id)))
    .returning({ id: pages.id });
  if (rows.length === 0) notFound();
  return { ok: true };
}
