"use client";

import { useActionState } from "react";
import { createPage } from "./actions";

export function CreatePageForm({ kind = "page" }: { kind?: "page" | "post" }) {
  const [state, action, pending] = useActionState(createPage, {});
  return (
    <form action={action} aria-label={`New ${kind}`} className="flex flex-col gap-3 items-start max-w-sm">
      <input type="hidden" name="kind" value={kind} />
      <h2 className="text-xl font-semibold">New {kind}</h2>
      <label className="flex flex-col gap-1 w-full">
        Title
        <input name="title" defaultValue={state.title} required className="border rounded px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 w-full">
        Slug
        <input name="slug" defaultValue={state.slug} required placeholder="about-us" className="border rounded px-3 py-2" />
      </label>
      {state.error && (
        <p role="alert" className="text-danger">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="border rounded px-3 py-2 font-semibold">
        Create {kind}
      </button>
    </form>
  );
}
