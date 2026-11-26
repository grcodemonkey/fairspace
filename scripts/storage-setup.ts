// Creates the media bucket if it is missing and sets CORS so the browser can PUT to presigned URLs.
// Idempotent. Run by `pnpm db:up` (local bucket) and vitest.global-setup.ts (test bucket). Local SeaweedFS only.
import { CreateBucketCommand, HeadBucketCommand, PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";

export async function setupStorage(env: NodeJS.ProcessEnv = process.env) {
  const bucket = env.S3_BUCKET ?? "fairspace";
  const client = new S3Client({
    endpoint: env.S3_ENDPOINT ?? "http://localhost:8333",
    region: env.S3_REGION ?? "auto",
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID ?? "fairspace",
      secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? "fairspace",
    },
  });
  try {
    await client
      .send(new HeadBucketCommand({ Bucket: bucket }))
      .catch(() => client.send(new CreateBucketCommand({ Bucket: bucket })));
    await client.send(
      new PutBucketCorsCommand({
        Bucket: bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: [env.AUTH_URL ?? "http://localhost:3000"],
              AllowedMethods: ["PUT", "GET", "HEAD"],
              AllowedHeaders: ["Content-Type"],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      }),
    );
  } finally {
    client.destroy();
  }
}

// Run directly by `pnpm db:up`. Not import.meta: Playwright loads this file as CommonJS.
if (process.argv[1]?.endsWith("storage-setup.ts")) void setupStorage();
