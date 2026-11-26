import { Suspense } from "react";
import { requireUser } from "@/guards";
import { listMedia } from "@/media-library";
import { MediaRow } from "./media-row";
import { UploadForm } from "./upload-form";

// Any signed-in user can upload and browse. Delete rules are in deleteMediaAction.
export default function MediaPage() {
  return (
    <main className="p-8">
      <Suspense fallback={<p>Loading…</p>}>
        <MediaLibrary />
      </Suspense>
    </main>
  );
}

// Guard first, in the same Suspense child that fetches the list.
async function MediaLibrary() {
  const user = await requireUser();
  const items = await listMedia();
  return (
    <>
      <h1 className="text-3xl font-bold mb-4">Media</h1>
      <UploadForm />
      <h2 className="text-xl font-semibold mt-8 mb-2">Library</h2>
      {items.length ? (
        <ul className="flex flex-col gap-4">
          {items.map((item) => (
            <MediaRow
              key={item.id}
              item={item}
              uploadedOn={item.uploadedAt!.toISOString().slice(0, 10)}
              canDelete={user.role === "admin" || item.uploadedBy === user.id}
            />
          ))}
        </ul>
      ) : (
        <p>No media yet.</p>
      )}
    </>
  );
}
