"use client";

import { type Data, Puck, useGetPuck } from "@puckeditor/core";
// Not puck.css: that one loads a font from Puck's CDN.
import "@puckeditor/core/no-external.css";
import Link from "next/link";
import { useCallback, useMemo, useState, useTransition } from "react";
import type { MediaItem, MediaMap } from "@/media";
import { pageConfig } from "@/puck/config";
import { publishPage, saveDraft } from "../../actions";
import { MediaFieldRender, RememberMediaContext } from "./media-field";

export function PageEditor({ id, title, draft, media: initialMedia }: { id: string; title: string; draft: Data; media: MediaMap }) {
  // Puck copies a changed `metadata` prop into its store, so a picked image shows in the preview at once.
  const [media, setMedia] = useState(initialMedia);
  const metadata = useMemo(() => ({ media }), [media]);
  const remember = useCallback(
    ({ id, url, alt }: MediaItem) => setMedia((current) => ({ ...current, [id]: { url, alt } })),
    [],
  );
  // Stable: publish re-renders this page (updateTag refreshes it), and a new override function remounts the
  // actions and loses their status.
  const overrides = useMemo(() => ({ headerActions: () => <EditorActions id={id} />, fieldTypes: { media: MediaFieldRender } }), [id]);
  return (
    <RememberMediaContext value={remember}>
      <Puck config={pageConfig} data={draft} headerTitle={title} overrides={overrides} metadata={metadata} />
    </RememberMediaContext>
  );
}

// Replaces Puck's own "Publish" button. Both actions send the editor's current data.
function EditorActions({ id }: { id: string }) {
  const getPuck = useGetPuck();
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();
  const [running, setRunning] = useState<"save" | "publish" | null>(null);

  const run = (kind: "save" | "publish") =>
    startTransition(async () => {
      setStatus("");
      setRunning(kind);
      const action = kind === "save" ? saveDraft : publishPage;
      try {
        const result = await action(id, getPuck().appState.data);
        setStatus("ok" in result ? (kind === "save" ? "Saved" : "Published") : result.error);
      } catch {
        setStatus(kind === "save" ? "Could not save. Try again." : "Could not publish. Try again.");
      }
      setRunning(null);
    });

  const button = "border rounded px-3 py-1 font-semibold whitespace-nowrap";
  return (
    // The status sits on its own line under the buttons, so a long error never squeezes them.
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-3">
        <Link href={`/admin/pages/${id}/history`} className="underline">
          History
        </Link>
        <button type="button" onClick={() => run("save")} disabled={pending} className={`${button} bg-white`}>
          {pending && running === "save" ? "Saving…" : "Save draft"}
        </button>
        <button
          type="button"
          onClick={() => run("publish")}
          disabled={pending}
          className={`${button} bg-blue-700 text-white border-blue-700`}
        >
          {pending && running === "publish" ? "Publishing…" : "Publish"}
        </button>
      </div>
      <span role="status" aria-live="polite" className="max-w-md text-right text-sm empty:hidden">
        {status}
      </span>
    </div>
  );
}
