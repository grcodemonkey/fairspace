import { desc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";
import { getDb } from "@/db";
import { pages } from "@/db/schema";
import { requireUser } from "@/guards";
import { publicPath } from "@/puck/slug";
import { CreatePageForm } from "../pages/create-page-form";

// Edit and history stay on /admin/pages/<id>/..., shared with pages.
export default function NewsPage() {
  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-4">News</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <PostList />
      </Suspense>
    </main>
  );
}

// The guard and the query share one Suspense child, so no data loads before the guard passes.
async function PostList() {
  await requireUser();
  const rows = await getDb()
    .select({
      id: pages.id,
      title: pages.title,
      slug: pages.slug,
      updatedAt: pages.updatedAt,
      publishedAt: pages.publishedAt,
      publishedRevisionId: pages.publishedRevisionId,
    })
    .from(pages)
    .where(eq(pages.kind, "post"))
    // Never-published drafts first, then the newest.
    .orderBy(sql`${pages.publishedAt} desc nulls first`, desc(pages.createdAt));

  return (
    <div className="flex flex-col gap-8">
      {rows.length === 0 ? (
        <p>No posts yet.</p>
      ) : (
        <table className="text-left">
          <thead>
            <tr>
              <th className="pr-8 py-1">Title</th>
              <th className="pr-8 py-1">URL</th>
              <th className="pr-8 py-1">Status</th>
              <th className="pr-8 py-1">Publish date</th>
              <th className="pr-8 py-1">Updated</th>
              <th className="py-1">
                <span className="sr-only">History</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((post) => (
              <tr key={post.id}>
                <td className="pr-8 py-1">
                  <Link href={`/admin/pages/${post.id}/edit`} className="underline">
                    {post.title}
                  </Link>
                </td>
                <td className="pr-8 py-1">{publicPath("post", post.slug)}</td>
                <td className="pr-8 py-1">{post.publishedRevisionId ? "Live" : "Not published"}</td>
                <td className="pr-8 py-1">{post.publishedAt ? post.publishedAt.toISOString().slice(0, 10) : "—"}</td>
                <td className="pr-8 py-1">{post.updatedAt.toISOString().slice(0, 16).replace("T", " ")} UTC</td>
                <td className="py-1">
                  <Link href={`/admin/pages/${post.id}/history`} className="underline">
                    History
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <CreatePageForm kind="post" />
    </div>
  );
}
