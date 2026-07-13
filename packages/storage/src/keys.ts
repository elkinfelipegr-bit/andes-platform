// Tenant-prefixed object keys (ADR-008). This module is the ONLY place
// object keys are built or validated — a mis-scoped key is a cross-tenant
// data leak, so it carries RFC-001's strict testing tier exactly like the
// tRPC tenant middleware and the RLS policies.

export class StorageKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageKeyError";
  }
}

// Record ids are Prisma cuids: lowercase alphanumerics only. Anything
// outside this alphabet (separators, dots, whitespace, uppercase) is
// rejected outright — that is what makes traversal or prefix-forging
// through a crafted id impossible by construction.
const ID_PATTERN = /^[a-z0-9]{10,64}$/;

function assertId(value: string, label: string): void {
  if (!ID_PATTERN.test(value)) {
    throw new StorageKeyError(
      `${label} is not a valid record id for a storage key`,
    );
  }
}

/** The prefix every object belonging to a tenant lives under. */
export function tenantPrefix(tenantId: string): string {
  assertId(tenantId, "tenantId");
  return `tenants/${tenantId}/`;
}

/** Key for one immutable BIM model version file (always IFC, per RFC-002). */
export function bimVersionKey(input: {
  tenantId: string;
  bimModelId: string;
  versionId: string;
}): string {
  assertId(input.tenantId, "tenantId");
  assertId(input.bimModelId, "bimModelId");
  assertId(input.versionId, "versionId");
  return `tenants/${input.tenantId}/bim/${input.bimModelId}/${input.versionId}.ifc`;
}

// Extensions are a closed whitelist, never derived from the uploaded
// file name — the same reject-by-construction posture as ids.
export const PHOTO_EXTENSIONS = ["jpg", "jpeg", "png", "webp"] as const;
export type PhotoExtension = (typeof PHOTO_EXTENSIONS)[number];

/** Key for one inspection photo (sprint-10-domain-model.md). */
export function inspectionPhotoKey(input: {
  tenantId: string;
  inspectionId: string;
  photoId: string;
  extension: PhotoExtension;
}): string {
  assertId(input.tenantId, "tenantId");
  assertId(input.inspectionId, "inspectionId");
  assertId(input.photoId, "photoId");
  if (!PHOTO_EXTENSIONS.includes(input.extension)) {
    throw new StorageKeyError(
      "extension is not an accepted photo format for a storage key",
    );
  }
  return `tenants/${input.tenantId}/inspections/${input.inspectionId}/${input.photoId}.${input.extension}`;
}

/**
 * Fails closed unless `key` lives under the tenant's prefix. Callers must
 * run this on any key read back from the database before signing a URL for
 * it — defense in depth against a row written with a foreign key value.
 */
export function assertKeyInTenant(key: string, tenantId: string): void {
  const prefix = tenantPrefix(tenantId);
  if (!key.startsWith(prefix)) {
    throw new StorageKeyError("object key does not belong to this tenant");
  }
}
