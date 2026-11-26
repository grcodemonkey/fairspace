import { Suspense } from "react";
import { requireUser } from "@/guards";
import { UploadForm } from "./upload-form";

// Any signed-in user can upload. #9 adds the library (browse, pick, delete).
export default function MediaPage() {
  return (
    <main className="p-8">
      <Suspense fallback={<p>Loading…</p>}>
        <MediaUpload />
      </Suspense>
    </main>
  );
}

async function MediaUpload() {
  await requireUser();
  return (
    <>
      <h1 className="text-3xl font-bold mb-4">Media</h1>
      <UploadForm />
    </>
  );
}
