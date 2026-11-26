import { S3Client } from "@aws-sdk/client-s3";

type Storage = { client: S3Client; bucket: string };

const globalForStorage = globalThis as unknown as { storage?: Storage };

// Lazy like getDb(): `next build` and plain imports work with no S3_* vars; only a real call needs them.
export function getStorage(): Storage {
  if (globalForStorage.storage) return globalForStorage.storage;
  const { S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_FORCE_PATH_STYLE } =
    process.env;
  if (!S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
    throw new Error("S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be set");
  }
  const client = new S3Client({
    endpoint: S3_ENDPOINT || undefined, // unset = AWS S3
    region: S3_REGION || "auto",
    forcePathStyle: S3_FORCE_PATH_STYLE === "true",
    // The default adds a CRC32 of an empty body to presigned PUT URLs, so every real upload fails the check.
    requestChecksumCalculation: "WHEN_REQUIRED",
    credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
  });
  globalForStorage.storage = { client, bucket: S3_BUCKET };
  return globalForStorage.storage;
}
