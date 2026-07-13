// Cloudflare R2 access (ADR-008) through the S3-compatible API. This is
// the only module in the platform allowed to touch storage credentials.
// File bytes never transit the app (Vercel body limits, ADR-005): the
// server only signs short-lived URLs; browsers talk to R2 directly.
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export class StorageConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageConfigError";
  }
}

export interface StorageConfig {
  /** Account endpoint, e.g. https://<account-id>.r2.cloudflarestorage.com */
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

const ENV_KEYS = [
  "R2_ENDPOINT",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
] as const;

export function storageConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): StorageConfig {
  const missing = ENV_KEYS.filter((key) => !env[key]?.trim());
  if (missing.length > 0) {
    throw new StorageConfigError(
      `missing storage environment variables: ${missing.join(", ")}`,
    );
  }
  return {
    endpoint: env.R2_ENDPOINT!.trim(),
    accessKeyId: env.R2_ACCESS_KEY_ID!.trim(),
    secretAccessKey: env.R2_SECRET_ACCESS_KEY!.trim(),
    bucket: env.R2_BUCKET!.trim(),
  };
}

export interface HeadResult {
  size: number;
  contentType: string | null;
}

export interface StorageClient {
  /** Presigned PUT pinning content type and exact length. */
  presignedPutUrl(
    key: string,
    opts: { contentType: string; contentLength: number; expiresIn?: number },
  ): Promise<string>;
  /** Presigned GET for viewing/downloading an existing object. */
  presignedGetUrl(key: string, opts?: { expiresIn?: number }): Promise<string>;
  /** null when the object does not exist. */
  headObject(key: string): Promise<HeadResult | null>;
  /**
   * Removes an object. Only for draft-evidence flows where the row was
   * deleted first (ADR-008: the database is the index — no orphans).
   * Idempotent: deleting a missing key is not an error in S3.
   */
  deleteObject(key: string): Promise<void>;
}

const DEFAULT_EXPIRES_IN = 900; // 15 min
const MAX_EXPIRES_IN = 3600;

function clampExpiry(expiresIn: number | undefined): number {
  const value = expiresIn ?? DEFAULT_EXPIRES_IN;
  if (!Number.isInteger(value) || value < 1 || value > MAX_EXPIRES_IN) {
    throw new StorageConfigError(
      `expiresIn must be an integer between 1 and ${MAX_EXPIRES_IN} seconds`,
    );
  }
  return value;
}

function isNotFound(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const err = error as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return err.name === "NotFound" || err.$metadata?.httpStatusCode === 404;
}

export function createStorageClient(
  config: StorageConfig,
  s3: S3Client = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: true,
  }),
): StorageClient {
  return {
    async presignedPutUrl(key, opts) {
      const command = new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        ContentType: opts.contentType,
        ContentLength: opts.contentLength,
      });
      return getSignedUrl(s3, command, {
        expiresIn: clampExpiry(opts.expiresIn),
      });
    },
    async presignedGetUrl(key, opts) {
      const command = new GetObjectCommand({
        Bucket: config.bucket,
        Key: key,
      });
      return getSignedUrl(s3, command, {
        expiresIn: clampExpiry(opts?.expiresIn),
      });
    },
    async headObject(key) {
      try {
        const result = await s3.send(
          new HeadObjectCommand({ Bucket: config.bucket, Key: key }),
        );
        return {
          size: result.ContentLength ?? 0,
          contentType: result.ContentType ?? null,
        };
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },
    async deleteObject(key) {
      await s3.send(
        new DeleteObjectCommand({ Bucket: config.bucket, Key: key }),
      );
    },
  };
}
