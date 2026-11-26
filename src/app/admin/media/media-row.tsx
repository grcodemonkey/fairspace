"use client";

import Image from "next/image";
import { useActionState } from "react";
import { ALT_MAX, isImage, type MediaItem } from "@/media";
import { deleteMediaAction, updateAltAction } from "./actions";

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** A square preview. The filename is shown as text beside it, so the image alt may be empty. */
export function MediaThumb({ item }: { item: MediaItem }) {
  return (
    <div className="relative size-40 shrink-0 bg-gray-100 border rounded overflow-hidden flex items-center justify-center">
      {isImage(item.contentType) ? (
        <Image src={item.url} alt={item.alt ?? ""} fill sizes="160px" className="object-cover" />
      ) : (
        <span className="font-bold text-gray-600">PDF</span>
      )}
    </div>
  );
}

export function MediaRow({ item, uploadedOn, canDelete }: { item: MediaItem; uploadedOn: string; canDelete: boolean }) {
  const [altState, saveAlt, altPending] = useActionState(updateAltAction, {});
  const [deleteState, remove, deletePending] = useActionState(deleteMediaAction, {});
  const error = altState.error ?? deleteState.error;
  return (
    <li className="flex gap-4 border-t pt-4">
      <MediaThumb item={item} />
      <div className="flex flex-col gap-2 items-start">
        <a href={item.url} className="font-semibold underline break-all">
          {item.filename}
        </a>
        <p className="text-sm">
          {item.contentType} · {formatSize(item.size)} · uploaded {uploadedOn}
        </p>
        {isImage(item.contentType) && (
          <form action={saveAlt} className="flex flex-wrap gap-2 items-end">
            <input type="hidden" name="id" value={item.id} />
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold">Alt text</span>
              <input
                name="alt"
                defaultValue={item.alt ?? ""}
                maxLength={ALT_MAX}
                className="border rounded px-2 py-1 w-80"
              />
            </label>
            <label className="flex gap-1 items-center text-sm">
              <input type="checkbox" name="decorative" defaultChecked={item.alt === ""} />
              Decorative image
            </label>
            <button type="submit" disabled={altPending} className="border rounded px-2 py-1">
              Save
            </button>
            {item.alt === null && (
              <span className="text-sm bg-yellow-100 text-yellow-900 rounded px-2 py-1">No alt text</span>
            )}
          </form>
        )}
        {canDelete && (
          <form
            action={remove}
            onSubmit={(e) => {
              if (!confirm(`Delete ${item.filename}? This cannot be undone.`)) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={item.id} />
            <button type="submit" disabled={deletePending} className="border rounded px-2 py-1">
              Delete
            </button>
          </form>
        )}
        <p aria-live="polite" className="text-red-700">
          {error}
        </p>
      </div>
    </li>
  );
}
