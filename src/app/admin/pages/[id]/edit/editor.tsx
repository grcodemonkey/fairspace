"use client";

import { createUsePuck, type Data, Puck, useGetPuck } from "@puckeditor/core";
// Not puck.css: that one loads a font from Puck's CDN.
import "@puckeditor/core/no-external.css";
import Link from "next/link";
import { useCallback, useMemo, useState, useTransition } from "react";
import type { MediaItem, MediaMap } from "@/media";
import { pageConfig } from "@/puck/config";
import { h1Warning } from "@/puck/headings";
import { publishPage, saveDraft } from "../../actions";
import { MediaFieldRender, RememberMediaContext } from "./media-field";

export function PageEditor({
  id,
  kind,
  title,
  draft,
  media: initialMedia,
}: {
  id: string;
  kind: "page" | "post";
  title: string;
  draft: Data;
  media: MediaMap;
}) {
  // Puck copies a changed `metadata` prop into its store, so a picked image shows in the preview at once.
  const [media, setMedia] = useState(initialMedia);
  const metadata = useMemo(() => ({ media }), [media]);
  const remember = useCallback(
    ({ id, url, alt }: MediaItem) => setMedia((current) => ({ ...current, [id]: { url, alt } })),
    [],
  );
  // Stable: publish re-renders this page (updateTag refreshes it), and a new override function remounts the
  // actions and loses their status.
  const overrides = useMemo(
    () => ({ headerActions: () => <EditorActions id={id} kind={kind} />, fieldTypes: { media: MediaFieldRender } }),
    [id, kind],
  );
  return (
    <RememberMediaContext value={remember}>
      <Puck config={pageConfig} data={draft} headerTitle={title} overrides={overrides} metadata={metadata} />
    </RememberMediaContext>
  );
}

const usePuck = createUsePuck();

// Replaces Puck's own "Publish" button. Both actions send the editor's current data.
function EditorActions({ id, kind }: { id: string; kind: "page" | "post" }) {
  const warning = usePuck((s) => h1Warning(s.appState.data, kind));
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
    // The status sits on its own line under the buttons, so a long error never squeezes them (margin only when it has text).
    // data-fairspace: the axe scan of the editor covers only our parts, not Puck's own UI (#53).
    <div data-fairspace className="flex flex-col items-end">
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
      <span role="status" aria-live="polite" className={`max-w-md text-right text-sm ${status ? "mt-1" : ""}`}>
        {status}
      </span>
      {/* Always in the DOM (empty = zero height, no margin) so a screen reader announces a change. Advice only: it never blocks Save or Publish. */}
      <p role="status" aria-live="polite" className={`max-w-md text-right text-sm text-amber-900 ${warning ? "mt-1" : ""}`}>
        {warning && (
          <>
            <strong>Warning:</strong> {warning}
          </>
        )}
      </p>
    </div>
  );
}
