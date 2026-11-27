"use server";

import { sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import { getDb } from "@/db";
import { menuItems } from "@/db/schema";
import { requireAdmin } from "@/guards";
import { MENU_TAG, MenuError, parseMenu } from "@/menu";

// Drizzle wraps the driver error, so the Postgres code is on `cause`.
const isForeignKeyViolation = (error: unknown) => (error as { cause?: { code?: string } })?.cause?.code === "23503";

/** Replaces the whole menu. Last save wins. */
export async function saveMenu(input: unknown): Promise<{ ok: true } | { error: string }> {
  await requireAdmin();
  let items;
  try {
    items = parseMenu(input);
  } catch (error) {
    if (error instanceof MenuError) return { error: error.message };
    throw error;
  }
  // One insert: Postgres checks the parentId FK at the end of the statement.
  const rows = items.flatMap(({ label, pageId, url, children }, position) => {
    const id = crypto.randomUUID();
    return [
      { id, position, label, pageId, url },
      ...children.map((child, i) => ({ parentId: id, position: i, label: child.label, pageId: child.pageId, url: child.url })),
    ];
  });
  try {
    await getDb().transaction(async (tx) => {
      // Two saves at once would each delete only the old rows and both insert; the lock runs them one after the other.
      // SHARE ROW EXCLUSIVE does not block readers.
      await tx.execute(sql`lock table ${menuItems} in share row exclusive mode`);
      await tx.delete(menuItems);
      if (rows.length) await tx.insert(menuItems).values(rows);
    });
  } catch (error) {
    if (isForeignKeyViolation(error)) return { error: "A linked page no longer exists." };
    throw error;
  }
  updateTag(MENU_TAG);
  return { ok: true };
}
