import { asc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { getDb } from "@/db";
import { menuItems, pages } from "@/db/schema";
import { isSafeHref, UNSAFE_HREF_HINT } from "@/puck/safe-href";

// The menu save and every change to what is live (invalidatePage in src/puck/publish.ts) call updateTag(MENU_TAG).
export const MENU_TAG = "menu";
export const MAX_MENU_ITEMS = 50;
export const MAX_LABEL_LENGTH = 60;

/** One item as the editor sends it and as the save stores it. Exactly one of pageId and url is set. */
export type MenuInputItem = { label: string; pageId: string | null; url: string | null; children: MenuInputItem[] };
/** One item as the public site renders it. */
export type MenuLinkItem = { label: string; href: string; children: MenuLinkItem[] };

export class MenuError extends Error {}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** Checks the whole menu from the client. Throws MenuError with a message for the admin. */
export function parseMenu(input: unknown): MenuInputItem[] {
  let count = 0;
  const parseList = (list: unknown, depth: number): MenuInputItem[] => {
    if (list === undefined && depth === 2) return [];
    if (!Array.isArray(list)) throw new MenuError("The menu data is not valid.");
    if (depth === 2 && list.length > 0) throw new MenuError("The menu allows two levels only.");
    return list.map((raw) => {
      if (++count > MAX_MENU_ITEMS) throw new MenuError(`The menu allows at most ${MAX_MENU_ITEMS} items.`);
      const item = (raw ?? {}) as Record<string, unknown>;
      const label = text(item.label);
      if (!label) throw new MenuError("Every item needs a label.");
      if (label.length > MAX_LABEL_LENGTH)
        throw new MenuError(`Labels can have at most ${MAX_LABEL_LENGTH} characters.`);
      const pageId = text(item.pageId) || null;
      const url = text(item.url) || null;
      if (!pageId === !url) throw new MenuError(`"${label}" needs a page or a URL.`);
      if (url && !isSafeHref(url)) throw new MenuError(`The URL of "${label}" ${UNSAFE_HREF_HINT}.`);
      return { label, pageId, url, children: parseList(item.children, depth + 1) };
    });
  };
  return parseList(input, 0);
}

type Row = typeof menuItems.$inferSelect;
function toTree<T>(rows: Row[], map: (row: Row) => T): (T & { children: T[] })[] {
  return rows
    .filter((row) => !row.parentId)
    .map((top) => ({ ...map(top), children: rows.filter((row) => row.parentId === top.id).map(map) }));
}

/** All saved items for the admin editor, including links to unpublished pages. Admin code only. */
export async function getMenuForEdit() {
  const db = getDb();
  const [rows, pageList] = await Promise.all([
    db.select().from(menuItems).orderBy(asc(menuItems.position)),
    db
      .select({ id: pages.id, title: pages.title, published: pages.publishedRevisionId })
      .from(pages)
      .orderBy(asc(pages.title)),
  ]);
  const items: MenuInputItem[] = toTree(rows, ({ label, pageId, url }) => ({ label, pageId, url, children: [] }));
  return { items, pages: pageList.map(({ id, title, published }) => ({ id, title, published: !!published })) };
}

export const pageHref = (slug: string) => (slug === "home" ? "/" : `/${slug}`);

/** The public menu. Items whose page is not live are left out, with all their children. */
export async function getMenu(): Promise<MenuLinkItem[]> {
  // `next build` prerenders the site layout with no env vars. At run time a missing DATABASE_URL breaks every page.
  if (!process.env.DATABASE_URL) return [];
  return loadMenu();
}

async function loadMenu(): Promise<MenuLinkItem[]> {
  "use cache";
  cacheLife("max");
  cacheTag(MENU_TAG);
  const rows = await getDb()
    .select({ item: menuItems, slug: pages.slug, published: pages.publishedRevisionId })
    .from(menuItems)
    .leftJoin(pages, eq(pages.id, menuItems.pageId))
    .orderBy(asc(menuItems.position));
  const hrefs = new Map<string, string>();
  for (const { item, slug, published } of rows) {
    if (item.url && isSafeHref(item.url)) hrefs.set(item.id, item.url.trim());
    else if (item.pageId && published && slug) hrefs.set(item.id, pageHref(slug));
  }
  // A hidden item drops out here, so no label of an unpublished page reaches the public HTML.
  const visible = rows.map((r) => r.item).filter((item) => hrefs.has(item.id));
  return toTree(visible, (item) => ({ label: item.label, href: hrefs.get(item.id)!, children: [] }));
}
