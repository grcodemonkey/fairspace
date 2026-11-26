"use server";

import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { media } from "@/db/schema";
import { requireUser } from "@/guards";
import { ALLOWED_TYPES, MAX_BYTES, SNIFF_BYTES, sniffType, validateUpload } from "@/media";
import { getStorage } from "@/storage";

const UPLOAD_URL_SECONDS = 300;

// `user.id!`: database sessions put the whole users row on session.user, so the id is always set.

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

/**
 * Step 1: checks the declared type and size, stores a pending row, and returns a presigned PUT URL.
 * The URL is signed for this key, Content-Type and Content-Length only, so the bucket refuses any other body.
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
  const key = `media/${id}.${ALLOWED_TYPES[type]}`;
  // shortcut: a browser that never calls finishUpload leaves a pending row and maybe an object; add a sweeper with #9.
  await getDb().insert(media).values({ id, key, filename, contentType: type, size: input.size, uploadedBy: user.id! });

  const { client, bucket } = getStorage();
  const url = await getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: type, ContentLength: input.size }),
    // Without this the presigner leaves Content-Type unsigned, and the browser could store any type.
    { expiresIn: UPLOAD_URL_SECONDS, signableHeaders: new Set(["content-type"]) },
  );
  return { ok: true, id, url };
}

/**
 * Step 2: checks the stored object (size, type and magic bytes) and marks the row uploaded.
 * On any mismatch it deletes the object and the row.
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
  const object = { Bucket: bucket, Key: row.key };
  let valid = false;
  try {
    const head = await client.send(new HeadObjectCommand(object));
    if (head.ContentLength === row.size && head.ContentLength <= MAX_BYTES && head.ContentType === row.contentType) {
      const start = await client.send(new GetObjectCommand({ ...object, Range: `bytes=0-${SNIFF_BYTES - 1}` }));
      valid = sniffType(await start.Body!.transformToByteArray()) === row.contentType;
    }
  } catch {
    // Missing object (the PUT failed or never ran): treat as invalid.
  }

  if (!valid) {
    await client.send(new DeleteObjectCommand(object)).catch(() => {});
    await db.delete(media).where(eq(media.id, row.id));
    return { ok: false, error: "The file content does not match its type." };
  }
  await db.update(media).set({ uploadedAt: new Date() }).where(eq(media.id, row.id));
  return { ok: true, filename: row.filename };
}
