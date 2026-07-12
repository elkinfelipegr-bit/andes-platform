// Storage access for the BIM router. Lazily builds the ADR-008 client
// from env on first real use (Vercel provides R2_* in prod/preview) and
// lets tests inject a fake — CI has no R2 credentials and must never
// need them (sprint-8.md testing commitments: mock the S3 boundary).
import {
  createStorageClient,
  storageConfigFromEnv,
  type StorageClient,
} from "@andes/storage";

let cached: StorageClient | null = null;
let override: StorageClient | null = null;

export function getStorage(): StorageClient {
  if (override) return override;
  cached ??= createStorageClient(storageConfigFromEnv());
  return cached;
}

export function setStorageForTesting(client: StorageClient | null): void {
  override = client;
}
