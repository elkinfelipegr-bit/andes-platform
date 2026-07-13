// The API's single storage seam (ADR-008). Lazily builds the client
// from env on first real use and lets tests inject a fake — CI has no
// R2 credentials and must never need them. Shared by every file-bearing
// module (BIM versions, inspection photos, ...).
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
