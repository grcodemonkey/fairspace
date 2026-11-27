"use client";

import { useActionState } from "react";
import { restoreRevision, setPostDate, unpublishPage } from "../../actions";

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

/** A news post's publish date (UTC day). `max` is a hint only: setPostDate refuses a day after today. */
export function PostDateForm({ id, date, max }: { id: string; date: string; max: string }) {
  const [state, action, pending] = useActionState(setPostDate, {});
  return (
    <form action={action} aria-label="Publish date" className="flex items-end gap-3">
      <input type="hidden" name="id" value={id} />
      <label className="flex flex-col gap-1">
        Publish date (UTC)
        <input type="date" name="date" defaultValue={date} max={max} required className="border rounded px-3 py-2" />
      </label>
      <button type="submit" disabled={pending} className="border rounded px-3 py-2 font-semibold">
        Save date
      </button>
      <p aria-live="polite" className={state.error ? "text-red-700" : undefined}>
        {state.error ?? state.message}
      </p>
    </form>
  );
}
