"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { MediaItem } from "@/media";
import { listMediaAction } from "./actions";
import { MediaThumb } from "./media-row";
import { UploadForm } from "./upload-form";

/**
 * Chooses a file from the media library, or uploads a new one.
 * Puck pages use it through the `media` field type (edit/media-field.tsx). #18: use with a hidden input. Store the id; read alt and URL at
 * render time, so alt edits in the library show on pages.
 */
export function MediaPicker({
  value,
  onChange,
  imagesOnly = true,
  label = "Media",
}: {
  value: string | null;
  onChange: (item: MediaItem | null) => void;
  imagesOnly?: boolean;
  label?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(
    () =>
      listMediaAction({ imagesOnly }).then(
        (list) => (setItems(list), list),
        () => (setError("Could not load the media library."), []),
      ),
    [imagesOnly],
  );
  // The current choice needs the list for its thumbnail and filename.
  useEffect(() => {
    if (value && !items) void load();
  }, [value, items, load]);

  const current = value ? items?.find((item) => item.id === value) : undefined;
  const pick = (item: MediaItem) => {
    onChange(item);
    dialog.current?.close();
  };

  return (
    // data-fairspace: in the page editor, the axe scan covers only our parts, not Puck's own UI (#53).
    <div data-fairspace className="flex flex-col gap-2 items-start">
      <span className="font-semibold">{label}</span>
      {current ? (
        <div className="flex gap-2 items-center">
          <MediaThumb item={current} />
          <span>{current.filename}</span>
        </div>
      ) : (
        <span className="text-sm">{value && items ? "The chosen file was deleted." : "None chosen."}</span>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          className="border rounded px-2 py-1"
          onClick={() => {
            dialog.current?.showModal(); // focus trap and Esc come with the native modal
            void load();
          }}
        >
          Choose media
        </button>
        {value && (
          <button type="button" className="border rounded px-2 py-1" onClick={() => onChange(null)}>
            Remove
          </button>
        )}
      </div>
      <dialog ref={dialog} aria-labelledby={titleId} className="m-auto p-6 rounded max-w-4xl backdrop:bg-black/50">
        <div className="flex justify-between items-center mb-4">
          <h2 id={titleId} className="text-xl font-bold">
            Choose media
          </h2>
          <button type="button" className="border rounded px-2 py-1" onClick={() => dialog.current?.close()}>
            Close
          </button>
        </div>
        <UploadForm
          onUploaded={async (id) => {
            const item = (await load()).find((i) => i.id === id);
            if (item) pick(item);
          }}
        />
        <p aria-live="polite" className="text-danger">
          {error}
        </p>
        {items?.length === 0 && <p>No media yet.</p>}
        <ul className="grid grid-cols-4 gap-4 mt-4">
          {items?.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                aria-pressed={item.id === value}
                onClick={() => pick(item)}
                className="flex flex-col gap-1 items-start text-left"
              >
                <MediaThumb item={item} />
                <span className="text-sm break-all">{item.filename}</span>
              </button>
            </li>
          ))}
        </ul>
      </dialog>
    </div>
  );
}
