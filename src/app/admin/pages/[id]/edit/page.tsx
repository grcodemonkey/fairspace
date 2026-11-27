import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getDb } from "@/db";
import { pages } from "@/db/schema";
import { requireUser } from "@/guards";
import { resolvePageMedia } from "@/media-library";
import { PageEditor } from "./editor";

export default function EditPagePage({ params }: PageProps<"/admin/pages/[id]/edit">) {
  return (
    <Suspense fallback={<p className="p-8">Loading…</p>}>
      <EditorLoader params={params} />
    </Suspense>
  );
}

// The guard and the query share one Suspense child, so no data loads before the guard passes.
async function EditorLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser();
  const [page] = await getDb()
    .select({ id: pages.id, title: pages.title, draft: pages.draft })
    .from(pages)
    .where(eq(pages.id, id))
    .limit(1);
  if (!page) notFound();
  return <PageEditor id={page.id} title={page.title} draft={page.draft} media={await resolvePageMedia(page.draft)} />;
}
