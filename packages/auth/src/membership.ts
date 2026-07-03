// Resolves the tenant + role context every session must carry (ADR-002,
// RFC-001): the "one active tenant per user" Sprint 0 rule lives here, at
// the application layer, so relaxing it later is a code change, not a
// migration (sprint-0-domain-model.md, open question 1).

export interface ActiveMembership {
  membershipId: string;
  tenantId: string;
  tenantSlug: string;
  roleKey: string;
  roleLabel: string;
}

// Structural subset of PrismaClient so unit tests can pass a fake without
// a live database (integration coverage runs against real Postgres in CI).
export interface MembershipReader {
  membership: {
    findMany(args: {
      where: { userId: string };
      include: { role: true; tenant: true };
    }): Promise<
      Array<{
        id: string;
        tenantId: string;
        tenant: { slug: string };
        role: { key: string; label: string };
      }>
    >;
  };
}

export class MultipleTenantMembershipsError extends Error {
  constructor(userId: string, count: number) {
    super(
      `User ${userId} has ${count} tenant memberships; Sprint 0 allows exactly one active tenant per user (RFC-001). Failing closed.`,
    );
    this.name = "MultipleTenantMembershipsError";
  }
}

// Returns null for a user with no membership yet (e.g. just signed up,
// awaiting invite acceptance). Throws — fails closed — if the Sprint 0
// single-membership invariant is violated, rather than guessing a tenant.
export async function getActiveMembership(
  db: MembershipReader,
  userId: string,
): Promise<ActiveMembership | null> {
  const memberships = await db.membership.findMany({
    where: { userId },
    include: { role: true, tenant: true },
  });

  if (memberships.length === 0) return null;
  if (memberships.length > 1) {
    throw new MultipleTenantMembershipsError(userId, memberships.length);
  }

  const membership = memberships[0]!;
  return {
    membershipId: membership.id,
    tenantId: membership.tenantId,
    tenantSlug: membership.tenant.slug,
    roleKey: membership.role.key,
    roleLabel: membership.role.label,
  };
}
