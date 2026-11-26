// Server only: the media library queries and the pending-upload sweeper.
import { DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { and, desc, eq, isNotNull, isNull, like, lt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { media } from "@/db/schema";
import { mediaUrl } from "@/media";
import { getStorage } from "@/storage";

const HOUR = 60 * 60 * 1000;

/** Finished uploads, newest first. */
export async function listMedia({ imagesOnly = false } = {}) {
  // shortcut: no pagination, 500 newest; add paging when a site passes that.
  const rows = await getDb()
    .select({
      id: media.id,
      filename: media.filename,
      contentType: media.contentType,
      size: media.size,
      alt: media.alt,
      uploadedBy: media.uploadedBy,
      uploadedAt: media.uploadedAt,
    })
    .from(media)
    .where(and(isNotNull(media.uploadedAt), imagesOnly ? like(media.contentType, "image/%") : undefined))
    .orderBy(desc(media.uploadedAt))
    .limit(500);
  return rows.map((row) => ({ ...row, url: mediaUrl(row) }));
}

/** A finished upload, or undefined when it is missing or still pending. */
export async function getServableMedia(id: string) {
  const [row] = await getDb()
    .select()
    .from(media)
    .where(and(eq(media.id, id), isNotNull(media.uploadedAt)));
  return row;
}

/**
 * Pages whose draft or published revision contains the media id. UUIDs are unique, so a text search of the
 * Puck JSON finds a reference whatever the block shape. Older, unpublished revisions are not checked.
 * position(), not like: no wildcard escaping.
 */
export async function findMediaUsage(id: string): Promise<{ id: string; title: string }[]> {
  // shortcut: full scan of draft and published jsonb; fine for a small site, add a media-usage table if pages reach the thousands.
  const rows = await getDb().execute<{ id: string; title: string }>(sql`
    select p.id, p.title from pages p
    left join page_revisions r on r.id = p."publishedRevisionId" and r."pageId" = p.id
    where position(${id} in p.draft::text) > 0 or position(${id} in r.data::text) > 0
    order by p.title`);
  return [...rows];
}

/**
 * Deletes abandoned uploads: pending rows older than `cutoff` with their staging objects, and any `uploads/`
 * object older than `cutoff` (also the stray one a PUT after finish leaves). 1 hour is safe: the PUT URL lives
 * 5 minutes. Object delete errors are ignored: the next sweep retries the listing.
 */
export async function sweepPendingUploads(cutoff = new Date(Date.now() - HOUR)) {
  const { client, bucket } = getStorage();
  const del = (Key: string) => client.send(new DeleteObjectCommand({ Bucket: bucket, Key })).catch(() => {});
  const rows = await getDb()
    .delete(media)
    .where(and(isNull(media.uploadedAt), lt(media.createdAt, cutoff)))
    .returning({ key: media.key });
  await Promise.all(rows.map((row) => del(row.key)));
  // One page (up to 1000 keys) per sweep; the next upload sweeps the rest.
  const list = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: "uploads/" }));
  await Promise.all(
    (list.Contents ?? []).filter((o) => o.Key && o.LastModified && o.LastModified < cutoff).map((o) => del(o.Key!)),
  );
}
