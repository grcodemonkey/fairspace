"use client";

import { useActionState } from "react";
import { restoreRevision, unpublishPage } from "../../actions";

export function RestoreButton({ pageId, revisionId }: { pageId: string; revisionId: string }) {
  const [state, action, pending] = useActionState(restoreRevision, {});
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Restore this revision? It goes live at once and replaces the draft.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="pageId" value={pageId} />
      <input type="hidden" name="revisionId" value={revisionId} />
      <button type="submit" disabled={pending} className="border rounded px-2 py-1">
        Restore
      </button>
      <p aria-live="polite" className={state.error ? "text-red-700" : undefined}>
        {state.error ?? state.message}
      </p>
    </form>
  );
}

export function UnpublishButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(unpublishPage, {});
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Unpublish this page? It goes off the site at once. The draft and the history stay.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className="border rounded px-2 py-1">
        Unpublish
      </button>
      <p aria-live="polite" className="text-red-700">
        {state.error}
      </p>
    </form>
  );
}
