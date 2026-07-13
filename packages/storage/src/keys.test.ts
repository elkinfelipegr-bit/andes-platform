// Strict-tier tests (RFC-001): a mis-scoped key is a cross-tenant leak.
// Every rejection path is exercised — these are the contract of the only
// module allowed to build or validate object keys (ADR-008).
import { describe, expect, it } from "vitest";

import {
  assertKeyInTenant,
  bimVersionKey,
  inspectionPhotoKey,
  StorageKeyError,
  tenantPrefix,
} from "./keys.js";

// Shaped like Prisma cuids (lowercase alphanumeric).
const TENANT = "clx0tenant000000000000001";
const MODEL = "clx0model0000000000000002";
const VERSION = "clx0version00000000000003";

describe("bimVersionKey", () => {
  it("builds the tenant-prefixed key", () => {
    expect(
      bimVersionKey({
        tenantId: TENANT,
        bimModelId: MODEL,
        versionId: VERSION,
      }),
    ).toBe(`tenants/${TENANT}/bim/${MODEL}/${VERSION}.ifc`);
  });

  const invalidIds: Array<[string, string]> = [
    ["empty", ""],
    ["too short", "abc123"],
    ["too long", "a".repeat(65)],
    ["uppercase", "CLX0TENANT000000000000001"],
    ["slash", "clx0tenant00000000/000001"],
    ["backslash", "clx0tenant00000000\\000001"],
    ["dot", "clx0tenant00000000.000001"],
    ["traversal", "../../clx0tenant000000001"],
    ["whitespace", "clx0tenant 00000000000001"],
    ["dash", "clx0tenant-00000000000001"],
    ["unicode", "clx0tenantñ00000000000001"],
    ["null byte", `clx0tenant${String.fromCharCode(0)}00000000000001`],
  ];

  for (const [label, bad] of invalidIds) {
    it(`rejects ${label} tenantId`, () => {
      expect(() =>
        bimVersionKey({ tenantId: bad, bimModelId: MODEL, versionId: VERSION }),
      ).toThrow(StorageKeyError);
    });
    it(`rejects ${label} bimModelId`, () => {
      expect(() =>
        bimVersionKey({
          tenantId: TENANT,
          bimModelId: bad,
          versionId: VERSION,
        }),
      ).toThrow(StorageKeyError);
    });
    it(`rejects ${label} versionId`, () => {
      expect(() =>
        bimVersionKey({ tenantId: TENANT, bimModelId: MODEL, versionId: bad }),
      ).toThrow(StorageKeyError);
    });
  }
});

describe("inspectionPhotoKey", () => {
  const input = {
    tenantId: TENANT,
    inspectionId: MODEL,
    photoId: VERSION,
    extension: "jpg" as const,
  };

  it("builds the tenant-prefixed key for every accepted extension", () => {
    for (const extension of ["jpg", "jpeg", "png", "webp"] as const) {
      expect(inspectionPhotoKey({ ...input, extension })).toBe(
        `tenants/${TENANT}/inspections/${MODEL}/${VERSION}.${extension}`,
      );
    }
  });

  it("rejects extensions outside the whitelist — never derived from file names", () => {
    for (const extension of ["exe", "svg", "php", "", "jpg/../x", "JPG"]) {
      expect(() =>
        inspectionPhotoKey({
          ...input,
          extension: extension as "jpg",
        }),
      ).toThrow(StorageKeyError);
    }
  });

  it("rejects invalid ids on every field", () => {
    expect(() => inspectionPhotoKey({ ...input, tenantId: "../etc" })).toThrow(
      StorageKeyError,
    );
    expect(() =>
      inspectionPhotoKey({ ...input, inspectionId: "UPPER/case" }),
    ).toThrow(StorageKeyError);
    expect(() => inspectionPhotoKey({ ...input, photoId: "" })).toThrow(
      StorageKeyError,
    );
  });
});

describe("tenantPrefix", () => {
  it("ends with a slash so prefixes cannot be forged by extension", () => {
    expect(tenantPrefix(TENANT)).toBe(`tenants/${TENANT}/`);
  });

  it("rejects invalid tenant ids", () => {
    expect(() => tenantPrefix("../etc")).toThrow(StorageKeyError);
  });
});

describe("assertKeyInTenant", () => {
  const key = bimVersionKey({
    tenantId: TENANT,
    bimModelId: MODEL,
    versionId: VERSION,
  });

  it("accepts a key under the tenant prefix", () => {
    expect(() => assertKeyInTenant(key, TENANT)).not.toThrow();
  });

  it("rejects a key belonging to another tenant", () => {
    expect(() => assertKeyInTenant(key, MODEL)).toThrow(StorageKeyError);
  });

  it("rejects prefix-extension forgery (tenantId that is a prefix of another)", () => {
    // key for tenant "<TENANT>x..." must not validate for tenant "<TENANT>"
    const longerTenant = `${TENANT.slice(0, 30)}xx`;
    const foreignKey = `tenants/${longerTenant}/bim/${MODEL}/${VERSION}.ifc`;
    expect(() => assertKeyInTenant(foreignKey, TENANT.slice(0, 30))).toThrow(
      StorageKeyError,
    );
  });

  it("rejects keys outside the tenants/ namespace", () => {
    expect(() => assertKeyInTenant(`public/${VERSION}.ifc`, TENANT)).toThrow(
      StorageKeyError,
    );
  });

  it("fails closed on an invalid tenantId before comparing", () => {
    expect(() => assertKeyInTenant(key, "")).toThrow(StorageKeyError);
    expect(() => assertKeyInTenant(key, "tenants/")).toThrow(StorageKeyError);
  });
});
