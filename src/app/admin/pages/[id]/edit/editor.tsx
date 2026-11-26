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
    <div className="flex items-center gap-3">
      <span role="status" aria-live="polite">
        {status}
      </span>
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="border rounded px-3 py-1 font-semibold bg-white"
      >
        {pending ? "Saving…" : "Save draft"}
      </button>
    </div>
  );
}
