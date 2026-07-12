// @andes/storage — object storage per ADR-008 (Cloudflare R2, S3 API).
// Key construction/validation is tenant-isolation logic (RFC-001 strict
// tier); the client only ever signs URLs — bytes never transit the app.
export {
  assertKeyInTenant,
  bimVersionKey,
  StorageKeyError,
  tenantPrefix,
} from "./keys.js";
export {
  createStorageClient,
  storageConfigFromEnv,
  StorageConfigError,
  type HeadResult,
  type StorageClient,
  type StorageConfig,
} from "./r2.js";
