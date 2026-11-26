"use client";

import { type Data, Puck, useGetPuck } from "@puckeditor/core";
// Not puck.css: that one loads a font from Puck's CDN.
import "@puckeditor/core/no-external.css";
import { useState, useTransition } from "react";
import { pageConfig } from "@/puck/config";
import { saveDraft } from "../../actions";

export function PageEditor({ id, title, draft }: { id: string; title: string; draft: Data }) {
  return (
    <Puck
      config={pageConfig}
      data={draft}
      headerTitle={title}
      overrides={{ headerActions: () => <SaveDraftButton id={id} /> }}
    />
  );
}

// Replaces Puck's own "Publish" button: publishing is a later step (#12).
function SaveDraftButton({ id }: { id: string }) {
  const getPuck = useGetPuck();
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      setStatus("");
      try {
        const result = await saveDraft(id, getPuck().appState.data);
        setStatus("ok" in result ? "Saved" : result.error);
      } catch {
        setStatus("Could not save. Try again.");
      }
    });

  return (
    // The status sits on its own line under the button, so a long error never squeezes the button.
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="border rounded px-3 py-1 font-semibold bg-white whitespace-nowrap"
      >
        {pending ? "Saving…" : "Save draft"}
      </button>
      <span role="status" aria-live="polite" className="max-w-md text-right text-sm empty:hidden">
        {status}
      </span>
    </div>
  );
}
