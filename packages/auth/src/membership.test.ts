// Tenant-isolation logic — mandatory strict-tier tests per PROJECT_RULES
// ("Do not skip tests for tenant-isolation logic"). Unit tier with a fake
// reader; DB-backed integration tier runs in CI (ADR-006, proposed).
import { describe, expect, it } from "vitest";

import {
  getActiveMembership,
  MultipleTenantMembershipsError,
  type MembershipReader,
} from "./membership.js";

function readerWith(
  rows: Array<{
    id: string;
    tenantId: string;
    tenant: { slug: string };
    role: { key: string; label: string };
  }>,
): MembershipReader {
  return {
    membership: {
      findMany: async () => rows,
    },
  };
}

const andesRow = {
  id: "m1",
  tenantId: "t-andes",
  tenant: { slug: "andes-engineering" },
  role: { key: "ENGINEER", label: "Engineer" },
};

describe("getActiveMembership", () => {
  it("returns null for a user with no tenant membership", async () => {
    await expect(getActiveMembership(readerWith([]), "u1")).resolves.toBeNull();
  });

  it("resolves the single membership to tenant + role context", async () => {
    await expect(getActiveMembership(readerWith([andesRow]), "u1")).resolves.toEqual({
      membershipId: "m1",
      tenantId: "t-andes",
      tenantSlug: "andes-engineering",
      roleKey: "ENGINEER",
      roleLabel: "Engineer",
    });
  });

  it("fails closed when the Sprint 0 one-tenant-per-user invariant is violated", async () => {
    const twoTenants = readerWith([
      andesRow,
      {
        id: "m2",
        tenantId: "t-other",
        tenant: { slug: "other-firm" },
        role: { key: "OWNER_ADMIN", label: "Owner / Admin" },
      },
    ]);

    await expect(getActiveMembership(twoTenants, "u1")).rejects.toBeInstanceOf(
      MultipleTenantMembershipsError,
    );
  });
});
