import { createReadStream } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env.js";
import { digitalFilesDir, uploadsDir } from "./storage.js";

/** Kinds accepted by POST /api/v1/uploads (mirrors upload.routes.ts). */
export type UploadKind = "voice" | "audio" | "video" | "image" | "file" | "digital";

/** Bucket folder per upload kind. */
const KIND_FOLDER: Record<UploadKind, string> = {
  voice: "voice",
  audio: "audio",
  video: "video",
  image: "images",
  file: "files",
  digital: "digital",
};

/** Kinds whose objects are publicly readable (digital stays protected). */
const PUBLIC_KINDS = new Set<UploadKind>(["voice", "audio", "video", "image", "file"]);

let client: S3Client | null = null;

/** R2 is used only when its credentials are fully configured. */
export function isR2Configured(): boolean {
  return Boolean(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET);
}

function r2Client(): S3Client {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID!,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return client;
}

export function r2PublicUrl(key: string): string | null {
  if (!env.R2_PUBLIC_BASE_URL) return null;
  return `${env.R2_PUBLIC_BASE_URL}/${key}`;
}

/** Where multer lands a file for the given kind (temp stop before R2). */
function localPathFor(kind: UploadKind, filename: string): string {
  return path.join(kind === "digital" ? digitalFilesDir() : uploadsDir(), filename);
}

export interface StoredUpload {
  /** Public URL for public kinds; null for protected digital files. */
  url: string | null;
  /** Bucket key (R2) or file name (local fallback). */
  storageKey: string;
}

/**
 * Persists an uploaded file. With R2 configured the object is streamed into
 * the bucket (multipart) and the local temp copy is removed; without R2 the
 * file stays on local disk exactly as before.
 */
export async function storeUpload(
  kind: UploadKind,
  file: { filename: string; mimetype: string },
): Promise<StoredUpload> {
  const localPath = localPathFor(kind, file.filename);

  if (!isR2Configured()) {
    return {
      url: PUBLIC_KINDS.has(kind) ? `/uploads/${file.filename}` : null,
      storageKey: file.filename,
    };
  }

  const key = `${KIND_FOLDER[kind]}/${file.filename}`;
  await new Upload({
    client: r2Client(),
    params: {
      Bucket: env.R2_BUCKET!,
      Key: key,
      ContentType: file.mimetype,
      Body: createReadStream(localPath),
    },
  }).done();
  await rm(localPath, { force: true });

  return {
    url: PUBLIC_KINDS.has(kind) ? r2PublicUrl(key) : null,
    storageKey: key,
  };
}

/**
 * Best-effort removal of a stored object from both backends (R2 + local
 * disk). Missing objects are ignored; callers must not rely on it throwing.
 */
export async function deleteStoredObject(storageKey: string): Promise<void> {
  if (isR2Configured()) {
    try {
      await r2Client().send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET!, Key: storageKey }));
    } catch {
      // Best-effort cleanup — the DB row is already gone.
    }
  }
  await rm(path.join(uploadsDir(), path.basename(storageKey)), { force: true });
  await rm(path.join(digitalFilesDir(), path.basename(storageKey)), { force: true });
}

/**
 * Short-lived authorized download URL for a protected digital product
 * (forces the original filename). Returns null when R2 is not in use and the
 * caller should stream the local file instead.
 */
export async function presignDigitalDownload(storageKey: string, fileName: string): Promise<string | null> {
  if (!isR2Configured()) return null;
  return getSignedUrl(
    r2Client(),
    new GetObjectCommand({
      Bucket: env.R2_BUCKET!,
      Key: storageKey,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(fileName)}"`,
    }),
    { expiresIn: 900 },
  );
}

/** Test hook — injects a preconfigured S3 client (used by the unit tests). */
export function setR2ClientForTests(injected: S3Client | null): void {
  client = injected;
}

/**
 * Seed/demo support — idempotently copies a local file into the bucket at
 * `key`. Existing objects are left untouched so reseeding never re-uploads.
 * Callers should gate on isR2Configured() first.
 */
export async function ensureBucketFile(key: string, localPath: string, contentType: string): Promise<void> {
  try {
    await r2Client().send(new HeadObjectCommand({ Bucket: env.R2_BUCKET!, Key: key }));
    return;
  } catch {
    // Object absent — fall through and upload it.
  }
  await new Upload({
    client: r2Client(),
    params: {
      Bucket: env.R2_BUCKET!,
      Key: key,
      ContentType: contentType,
      Body: createReadStream(localPath),
    },
  }).done();
}

export { PutObjectCommand, GetObjectCommand, DeleteObjectCommand };
