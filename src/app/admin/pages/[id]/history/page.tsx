import { desc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getDb } from "@/db";
import { pageRevisions, pages, users } from "@/db/schema";
import { requireUser } from "@/guards";
import { publicPath } from "@/puck/slug";
import { PostDateForm, RestoreButton, SlugForm, UnpublishButton } from "./history-buttons";

const HISTORY_LIMIT = 200;
const formatDate = (date: Date) => `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;

export default function HistoryPage({ params }: PageProps<"/admin/pages/[id]/history">) {
  return (
    <main className="p-8">
      <Suspense fallback={<p>Loading…</p>}>
        <History params={params} />
      </Suspense>
    </main>
  );
}

// The guard and the queries share one Suspense child, so no data loads before the guard passes.
async function History({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const [page] = await getDb()
    .select({
      id: pages.id,
      kind: pages.kind,
      title: pages.title,
      slug: pages.slug,
      publishedAt: pages.publishedAt,
      publishedRevisionId: pages.publishedRevisionId,
    })
    .from(pages)
    .where(eq(pages.id, id));
  if (!page) notFound();
  const revisions = await getDb()
    .select({
      id: pageRevisions.id,
      createdAt: pageRevisions.createdAt,
      // Only the title: the full data can be 512 KB per revision.
      title: sql<string | null>`${pageRevisions.data}->'root'->'props'->>'title'`,
      author: sql<string>`coalesce(${users.name}, ${users.email}, 'Removed user')`,
    })
    .from(pageRevisions)
    .leftJoin(users, eq(users.id, pageRevisions.createdBy))
    .where(eq(pageRevisions.pageId, id))
    .orderBy(desc(pageRevisions.createdAt))
    // shortcut: only the latest 200 revisions; add paging if a page ever needs older ones in the UI.
    .limit(HISTORY_LIMIT);
  const isAdmin = user.role === "admin";
  const href = publicPath(page.kind, page.slug);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">History: {page.title}</h1>
      <div className="flex items-center gap-4">
        <Link href={`/admin/pages/${page.id}/edit`} className="underline">
          Back to the editor
        </Link>
        {page.kind === "post" && (
          <Link href="/admin/news" className="underline">
            Back to News
          </Link>
        )}
        {page.publishedRevisionId ? (
          <>
            <span>
              Live at{" "}
              <a href={href} className="underline">
                {href}
              </a>
            </span>
            <UnpublishButton id={page.id} />
          </>
        ) : (
          <span>Not published</span>
        )}
      </div>
      {page.slug === "home" ? (
        <p>The home page address cannot change.</p>
      ) : (
        <SlugForm id={page.id} slug={page.slug} prefix={page.kind === "post" ? "/news/" : "/"} />
      )}
      {page.kind === "post" && (
        <PostDateForm
          id={page.id}
          date={page.publishedAt?.toISOString().slice(0, 10) ?? ""}
          max={new Date().toISOString().slice(0, 10)}
        />
      )}
      {revisions.length === HISTORY_LIMIT && <p>Showing the latest {HISTORY_LIMIT} revisions.</p>}
      {revisions.length === 0 ? (
        <p>No revisions yet. Publish the page from the editor.</p>
      ) : (
        <table className="text-left">
          <thead>
            <tr>
              <th className="pr-8 py-1">Published</th>
              <th className="pr-8 py-1">By</th>
              <th className="pr-8 py-1">Title</th>
              <th className="py-1">Actions</th>
            </tr>
          </thead>
          <tbody>
            {revisions.map((revision) => {
              const live = revision.id === page.publishedRevisionId;
              return (
                <tr key={revision.id} className="border-t align-top">
                  <td className="pr-8 py-2">{formatDate(revision.createdAt)}</td>
                  <td className="pr-8 py-2">{revision.author}</td>
                  <td className="pr-8 py-2">{revision.title}</td>
                  <td className="py-2">
                    <div className="flex items-center gap-3">
                      {live && <span className="font-semibold">Live</span>}
                      <Link href={`/admin/pages/${page.id}/history/${revision.id}`} className="underline">
                        View
                      </Link>
                      {/* The UI only hides it; restoreRevision is the real gate. */}
                      {isAdmin && !live && <RestoreButton pageId={page.id} revisionId={revision.id} />}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
