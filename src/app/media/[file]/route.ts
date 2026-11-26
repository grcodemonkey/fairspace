import { GetObjectCommand } from "@aws-sdk/client-s3";
import { ALLOWED_TYPES, type AllowedType, isImage, UUID } from "@/media";
import { getServableMedia } from "@/media-library";
import { getStorage, isNotFound } from "@/storage";

const FILE = new RegExp(`^(${UUID})\\.([a-z]+)$`);
const EXTENSIONS: readonly string[] = Object.values(ALLOWED_TYPES);

// RFC 5987 value: encodeURIComponent leaves ' ( ) * as is, and they are not allowed there.
const rfc5987 = (name: string) =>
  encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

const notFound = () => new Response("Not found", { status: 404 });

/**
 * GET /media/<id>.<ext>: streams a finished upload from the private bucket.
 * PUBLIC, NO GUARD BY DESIGN: published pages embed these files for signed-out visitors. The id is an
 * unguessable UUID; pending rows and wrong extensions get 404. Every header comes from the DB row, never from the object.
 */
export async function GET(_: Request, { params }: { params: Promise<{ file: string }> }) {
  const match = FILE.exec((await params).file);
  if (!match || !EXTENSIONS.includes(match[2])) return notFound(); // no DB query for a bad name
  const row = await getServableMedia(match[1]);
  if (!row || ALLOWED_TYPES[row.contentType as AllowedType] !== match[2]) return notFound();

  const { client, bucket } = getStorage();
  let body: ReadableStream;
  try {
    const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: row.key }));
    if (!object.Body) return notFound();
    body = object.Body.transformToWebStream();
  } catch (e) {
    if (isNotFound(e)) return notFound();
    throw e;
  }

  const headers = new Headers({
    "Content-Type": row.contentType,
    "Content-Length": String(row.size),
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": `inline; filename*=UTF-8''${rfc5987(row.filename)}`,
    // 1 day: a deleted file leaves every cache within a day, with no purge.
    "Cache-Control": "public, max-age=86400",
  });
  // Not on PDFs: Chrome renders them under `sandbox` too, but other viewers are not checked. A PDF still cannot
  // render as HTML: fixed type, nosniff, and the magic bytes were checked at upload.
  if (isImage(row.contentType)) {
    headers.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  }
  // shortcut: full-body responses only (no Range, no ETag); add Range if large PDFs load slowly.
  return new Response(body, { headers });
}
