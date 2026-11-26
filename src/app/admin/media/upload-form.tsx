"use client";

import { useState, useSyncExternalStore } from "react";
import { ALLOWED_TYPES } from "@/media";
import { createUpload, finishUpload } from "./actions";

const subscribeNothing = () => () => {};

// Browser → createUpload (presigned URL) → PUT straight to the bucket → finishUpload (server checks the bytes).
// onUploaded: the picker reloads its list and selects the new file.
export function UploadForm({ onUploaded }: { onUploaded?: (id: string) => void } = {}) {
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);
  // Disabled until hydrated: a file picked earlier would have no onChange handler.
  // false on the server and during hydration, true after; no setState-in-effect.
  const ready = useSyncExternalStore(subscribeNothing, () => true, () => false);

  async function upload(file: File) {
    setBusy(true);
    setStatus("Uploading…");
    try {
      const created = await createUpload({ filename: file.name, type: file.type, size: file.size });
      if (!created.ok) return setStatus(created.error);
      // A failed PUT still goes to finishUpload, which removes the pending row.
      await fetch(created.url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      const finished = await finishUpload(created.id);
      setStatus(finished.ok ? `Uploaded ${finished.filename}` : finished.error);
      if (finished.ok) onUploaded?.(created.id);
    } catch {
      setStatus("Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 items-start">
      <label className="flex flex-col gap-1">
        <span className="font-semibold">Upload a file</span>
        <span className="text-sm">JPEG, PNG, WebP, GIF, AVIF or PDF, up to 10 MB.</span>
        <input
          type="file"
          accept={Object.keys(ALLOWED_TYPES).join(",")}
          disabled={busy || !ready}
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            e.currentTarget.value = "";
            if (file) void upload(file);
          }}
          className="border rounded px-3 py-2"
        />
      </label>
      <p role="status">{status}</p>
    </div>
  );
}
