"use client";

import { useState } from "react";
import { ALLOWED_TYPES } from "@/media";
import { createUpload, finishUpload } from "./actions";

// Browser → createUpload (presigned URL) → PUT straight to the bucket → finishUpload (server checks the bytes).
export function UploadForm() {
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    setStatus("Uploading…");
    try {
      const created = await createUpload({ filename: file.name, type: file.type, size: file.size });
      if (!created.ok) return setStatus(created.error);
      const put = await fetch(created.url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      // A failed PUT still goes to finishUpload, which removes the pending row.
      const finished = await finishUpload(created.id);
      if (!put.ok && finished.ok) return setStatus("Upload failed.");
      setStatus(finished.ok ? `Uploaded ${finished.filename}` : finished.error);
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
          disabled={busy}
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
