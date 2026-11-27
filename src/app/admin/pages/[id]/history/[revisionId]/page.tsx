import { Render } from "@puckeditor/core";
import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getDb } from "@/db";
import { pageRevisions } from "@/db/schema";
import { requireUser } from "@/guards";
import { pageConfig } from "@/puck/config";

export default function RevisionPage({ params }: PageProps<"/admin/pages/[id]/history/[revisionId]">) {
  return (
    <Suspense fallback={<p className="p-8">Loading…</p>}>
      <Revision params={params} />
    </Suspense>
  );
}

// The guard and the query share one Suspense child, so no data loads before the guard passes.
async function Revision({ params }: { params: Promise<{ id: string; revisionId: string }> }) {
  const { id, revisionId } = await params;
  await requireUser();
  const [revision] = await getDb()
    .select({ data: pageRevisions.data, createdAt: pageRevisions.createdAt })
    .from(pageRevisions)
    .where(and(eq(pageRevisions.id, revisionId), eq(pageRevisions.pageId, id)));
  if (!revision) notFound();
  return (
    <>
      <div className="flex gap-4 p-4 bg-yellow-100 text-black">
        <strong>Revision of {revision.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC</strong>
        <Link href={`/admin/pages/${id}/history`} className="underline">
          Back to the history
        </Link>
      </div>
      {/* Safe to render: parsePageData sanitized the data before publish wrote it, and restore parses it again. */}
      <Render config={pageConfig} data={revision.data} />
    </>
  );
}
