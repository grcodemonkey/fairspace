"use client";

import { useState, useTransition } from "react";
import type { MenuInputItem } from "@/menu";
import { saveMenu } from "./actions";

type PageOption = { id: string; title: string; published: boolean };
type Item = { key: string; label: string; type: "page" | "url"; pageId: string; url: string; children: Item[] };

const newKey = () => Math.random().toString(36).slice(2);
const toItem = (item: MenuInputItem): Item => ({
  key: newKey(),
  label: item.label,
  type: item.url ? "url" : "page",
  pageId: item.pageId ?? "",
  url: item.url ?? "",
  children: item.children.map(toItem),
});
const toInput = (item: Item): MenuInputItem => ({
  label: item.label,
  pageId: item.type === "page" ? item.pageId : null,
  url: item.type === "url" ? item.url : null,
  children: item.children.map(toInput),
});
const blank = (): Item => ({ key: newKey(), label: "", type: "page", pageId: "", url: "", children: [] });

const field = "border rounded px-3 py-2";
const button = "border rounded px-2 py-1 text-sm disabled:opacity-40";

export function MenuForm({ initial, pages }: { initial: MenuInputItem[]; pages: PageOption[] }) {
  const [items, setItems] = useState(() => initial.map(toItem));
  const [status, setStatus] = useState<{ error?: string; message?: string }>({});
  const [pending, startTransition] = useTransition();

  function save(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveMenu(items.map(toInput));
      setStatus("error" in result ? { error: result.error } : { message: "Saved" });
    });
  }

  return (
    <form onSubmit={save} aria-label="Menu" className="flex flex-col gap-4 items-start max-w-3xl">
      {items.length === 0 && <p>The menu is empty.</p>}
      <ItemList items={items} onChange={setItems} pages={pages} prefix="" />
      <div className="flex gap-3 items-center">
        <button type="button" className={button} onClick={() => setItems([...items, blank()])}>
          Add item
        </button>
        <button type="submit" disabled={pending} className="border rounded px-3 py-2 font-semibold">
          Save menu
        </button>
        <p role="status" className={status.error ? "text-red-700" : ""}>
          {status.error ?? status.message}
        </p>
      </div>
    </form>
  );
}

function ItemList(props: { items: Item[]; onChange: (items: Item[]) => void; pages: PageOption[]; prefix: string }) {
  const { items, onChange, pages, prefix } = props;
  const set = (i: number, patch: Partial<Item>) => onChange(items.map((it, k) => (k === i ? { ...it, ...patch } : it)));
  const move = (i: number, by: number) => {
    const next = [...items];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    onChange(next);
  };
  if (items.length === 0) return null;

  return (
    <ol className={`flex flex-col gap-3 w-full ${prefix ? "pl-6" : ""}`}>
      {items.map((item, i) => {
        const name = `Item ${prefix}${i + 1}`;
        const id = `menu-${item.key}`;
        const named = (text: string) => (
          <>
            {text}
            <span className="sr-only"> {name}</span>
          </>
        );
        return (
          <li key={item.key}>
            <fieldset className="border rounded p-3 flex flex-col gap-3">
              <legend className="px-1 font-semibold">{name}</legend>
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex flex-col gap-1">
                  <label htmlFor={`${id}-label`}>Label</label>
                  <input
                    id={`${id}-label`}
                    value={item.label}
                    maxLength={60}
                    required
                    onChange={(e) => set(i, { label: e.target.value })}
                    className={field}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor={`${id}-type`}>Link to</label>
                  <select
                    id={`${id}-type`}
                    value={item.type}
                    onChange={(e) => set(i, { type: e.target.value as Item["type"] })}
                    className={field}
                  >
                    <option value="page">Page</option>
                    <option value="url">URL</option>
                  </select>
                </div>
                {item.type === "page" ? (
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`${id}-page`}>Page</label>
                    <select
                      id={`${id}-page`}
                      value={item.pageId}
                      required
                      onChange={(e) => set(i, { pageId: e.target.value })}
                      className={field}
                    >
                      <option value="">Choose a page</option>
                      {pages.map((page) => (
                        <option key={page.id} value={page.id}>
                          {page.title}
                          {page.published ? "" : " (not published)"}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`${id}-url`}>URL</label>
                    <input
                      id={`${id}-url`}
                      value={item.url}
                      required
                      placeholder="https://"
                      onChange={(e) => set(i, { url: e.target.value })}
                      className={field}
                    />
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={button} disabled={i === 0} onClick={() => move(i, -1)}>
                  {named("Move up")}
                </button>
                <button type="button" className={button} disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                  {named("Move down")}
                </button>
                <button type="button" className={button} onClick={() => onChange(items.filter((_, k) => k !== i))}>
                  {named("Remove")}
                </button>
                {!prefix && (
                  <button type="button" className={button} onClick={() => set(i, { children: [...item.children, blank()] })}>
                    {named("Add child")}
                  </button>
                )}
              </div>
              {!prefix && (
                <ItemList
                  items={item.children}
                  onChange={(children) => set(i, { children })}
                  pages={pages}
                  prefix={`${i + 1}.`}
                />
              )}
            </fieldset>
          </li>
        );
      })}
    </ol>
  );
}
