import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";
import { getDb } from "@/db";
import { pages } from "@/db/schema";
import { requireUser } from "@/guards";
import { CreatePageForm } from "./create-page-form";

export default function PagesPage() {
  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-4">Pages</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <PageList />
      </Suspense>
    </main>
  );
}

// The guard and the query share one Suspense child, so no data loads before the guard passes.
async function PageList() {
  await requireUser();
  const rows = await getDb()
    .select({
      id: pages.id,
      title: pages.title,
      slug: pages.slug,
      updatedAt: pages.updatedAt,
      publishedRevisionId: pages.publishedRevisionId,
    })
    .from(pages)
    .where(eq(pages.kind, "page")) // news posts are listed at /admin/news
    .orderBy(asc(pages.title));

  return (
    <div className="flex flex-col gap-8">
      {rows.length === 0 ? (
        <p>No pages yet.</p>
      ) : (
        <table className="text-left">
          <thead>
            <tr>
              <th className="pr-8 py-1">Title</th>
              <th className="pr-8 py-1">Slug</th>
              <th className="pr-8 py-1">Status</th>
              <th className="pr-8 py-1">Updated</th>
              <th className="py-1">
                <span className="sr-only">History</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((page) => (
              <tr key={page.id}>
                <td className="pr-8 py-1">
                  <Link href={`/admin/pages/${page.id}/edit`} className="underline">
                    {page.title}
                  </Link>
                </td>
                <td className="pr-8 py-1">/{page.slug}</td>
                <td className="pr-8 py-1">{page.publishedRevisionId ? "Live" : "Not published"}</td>
                <td className="pr-8 py-1">{page.updatedAt.toISOString().slice(0, 16).replace("T", " ")} UTC</td>
                <td className="py-1">
                  <Link href={`/admin/pages/${page.id}/history`} className="underline">
                    History
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <CreatePageForm />
    </div>
  );
}
