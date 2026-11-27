"use server";

import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { and, eq, isNotNull, isNull, like } from "drizzle-orm";
import { refresh, updateTag } from "next/cache";
import { after } from "next/server";
import { getDb } from "@/db";
import { media } from "@/db/schema";
import { requireUser } from "@/guards";
import { ALLOWED_TYPES, ALT_MAX, MAX_BYTES, type MediaItem, SNIFF_BYTES, sniffType, validateUpload } from "@/media";
import { findMediaUsage, listMedia, mediaTag, sweepPendingUploads } from "@/media-library";
import { isSiteLogo, SITE_SETTINGS_TAG } from "@/site-settings";
import { getStorage, isNotFound } from "@/storage";

const UPLOAD_URL_SECONDS = 300;

// `user.id!`: database sessions put the whole users row on session.user, so the id is always set.

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

/**
 * Step 1: checks the declared type and size, then returns a presigned PUT URL for a staging key
 * (`uploads/<id>`) and stores a pending row whose `key` is that staging key.
 * The URL is signed for this key, Content-Type and Content-Length only, so the bucket refuses any other body.
 * The browser never gets a URL for `media/`: only finishUpload writes there.
 */
export async function createUpload(input: {
  filename: string;
  type: string;
  size: number;
}): Promise<Result<{ id: string; url: string }>> {
  const user = await requireUser();
  const error = validateUpload(input);
  if (error) return { ok: false, error };
  const type = input.type as keyof typeof ALLOWED_TYPES;

  // The filename is display data only; the server picks the key.
  const filename = String(input.filename).trim().slice(0, 255) || "file";
  const id = crypto.randomUUID();
  const key = `uploads/${id}`;

  // Sign first: a signing error then leaves no row behind.
  const { client, bucket } = getStorage();
  const url = await getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: type, ContentLength: input.size }),
    // Without this the presigner leaves Content-Type unsigned, and the browser could store any type.
    { expiresIn: UPLOAD_URL_SECONDS, signableHeaders: new Set(["content-type"]) },
  );
  // An abandoned upload (no finishUpload, or a PUT after finish) is removed by sweepPendingUploads.
  await getDb().insert(media).values({ id, key, filename, contentType: type, size: input.size, uploadedBy: user.id! });
  // After the response: no latency, and no cron. A sweep error never fails the upload.
  after(() => sweepPendingUploads().catch((e) => console.error("sweepPendingUploads failed", e)));
  return { ok: true, id, url };
}

/**
 * Step 2: checks the staging object (size, type and magic bytes), copies it to `media/<id>.<ext>`,
 * deletes the staging object and marks the row uploaded with the final key.
 * On a mismatch it deletes the staging object and the row. On any other S3 error it throws and the row stays pending.
 */
export async function finishUpload(id: string): Promise<Result<{ filename: string }>> {
  const user = await requireUser();
  const db = getDb();
  const [row] = await db
    .select()
    .from(media)
    .where(and(eq(media.id, String(id)), eq(media.uploadedBy, user.id!), isNull(media.uploadedAt)));
  if (!row) return { ok: false, error: "Upload not found." };

  const { client, bucket } = getStorage();
  const staging = { Bucket: bucket, Key: row.key };
  const finalKey = `media/${row.id}.${ALLOWED_TYPES[row.contentType as keyof typeof ALLOWED_TYPES]}`;
  let copied = false;
  try {
    const head = await client.send(new HeadObjectCommand(staging));
    if (head.ContentLength === row.size && head.ContentLength <= MAX_BYTES && head.ContentType === row.contentType) {
      const start = await client.send(new GetObjectCommand({ ...staging, Range: `bytes=0-${SNIFF_BYTES - 1}` }));
      if (sniffType(await start.Body!.transformToByteArray()) === row.contentType) {
        // IfMatch: copy only the bytes that were checked. A PUT between the HEAD and the copy fails it (412).
        await client.send(
          new CopyObjectCommand({
            Bucket: bucket,
            Key: finalKey,
            CopySource: `${bucket}/${row.key}`,
            CopySourceIfMatch: head.ETag,
          }),
        );
        copied = true;
      }
    }
  } catch (e) {
    const changed = (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 412;
    if (!isNotFound(e) && !changed) throw e; // transient: keep the row pending
  }

  if (!copied) {
    // A failed delete throws before the row goes, so the row stays pending for the sweeper.
    await client.send(new DeleteObjectCommand(staging));
    await db.delete(media).where(eq(media.id, row.id));
    return { ok: false, error: "The file content does not match its type." };
  }
  await db.update(media).set({ key: finalKey, uploadedAt: new Date() }).where(eq(media.id, row.id));
  // The checked copy is safe in `media/`; a failed delete leaves only a stray `uploads/` object for the sweeper.
  await client.send(new DeleteObjectCommand(staging)).catch(() => {});
  refresh(); // the library shows the new file
  return { ok: true, filename: row.filename };
}

export type ActionState = { error?: string };

const idFrom = (formData: FormData) => {
  const id = formData.get("id");
  return typeof id === "string" ? id : "";
};

/** Any signed-in user may set alt text on any file (a shared library). Images only. */
export async function updateAltAction(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const raw = formData.get("alt");
  const alt = formData.get("decorative") ? "" : typeof raw === "string" ? raw.trim() : "";
  if (alt.length > ALT_MAX) return { error: `Alt text can be at most ${ALT_MAX} characters.` };
  if (!alt && !formData.get("decorative")) return { error: "Enter alt text, or mark the image as decorative." };
  const updated = await getDb()
    .update(media)
    .set({ alt })
    .where(and(eq(media.id, idFrom(formData)), isNotNull(media.uploadedAt), like(media.contentType, "image/%")))
    .returning({ id: media.id });
  if (!updated.length) return { error: "Image not found." };
  updateTag(mediaTag(updated[0].id)); // og:image:alt on pages
  refresh();
  return {};
}

/** Editors delete their own uploads; admins delete any. Refused while the draft or the live version of a page, or the site logo, uses the file. */
export async function deleteMediaAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const db = getDb();
  const [row] = await db
    .select()
    .from(media)
    .where(and(eq(media.id, idFrom(formData)), isNotNull(media.uploadedAt)));
  if (!row) return { error: "File not found." };
  if (user.role !== "admin" && row.uploadedBy !== user.id) return { error: "You can delete only your own uploads." };
  const pages = await findMediaUsage(row.id);
  if (pages.length) {
    return { error: `Used on: ${pages.map((p) => p.title).join(", ")}. Remove it from these pages first.` };
  }
  if (await isSiteLogo(row.id)) return { error: "Used as the site logo. Change the logo in Settings first." };
  await db.delete(media).where(eq(media.id, row.id));
  // Row first: a failed object delete leaves only an unreferenced object, which is safe.
  const { client, bucket } = getStorage();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: row.key })).catch(() => {});
  updateTag(mediaTag(row.id));
  // A logo set between the check and the delete becomes null (FK); the cached brand must not keep its URL.
  updateTag(SITE_SETTINGS_TAG);
  refresh();
  return {};
}

/** The picker's list. A server action, so `requireUser()` (which redirects) is the right guard. */
export async function listMediaAction({ imagesOnly = true } = {}): Promise<MediaItem[]> {
  await requireUser();
  return (await listMedia({ imagesOnly: Boolean(imagesOnly) })).map(({ id, filename, contentType, size, alt, url }) => ({
    id,
    filename,
    contentType,
    size,
    alt,
    url,
  }));
}
