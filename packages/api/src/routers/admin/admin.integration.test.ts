// Integration tests for the Administration router (sprint-12.md testing
// commitments): the full invite → accept flow and every denial that
// protects it — mismatched email, expired, revoked, reused token,
// already a member, another tenant's member — plus the last-OWNER_ADMIN
// guard and the cross-tenant sweep.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@andes/db";

import type { Context, SessionInfo } from "../../context.js";
import { createCallerFactory } from "../../trpc.js";
import { appRouter } from "../core.js";

const APP_URL = process.env.APP_DATABASE_URL;

describe.skipIf(!APP_URL)("admin router (integration)", () => {
  const admin = new PrismaClient();
  const app = new PrismaClient({ datasourceUrl: APP_URL });
  const createCaller = createCallerFactory(appRouter);

  const run = randomUUID().slice(0, 8);
  let tenantA!: { id: string };
  let tenantB!: { id: string };
  let ownerRoleA!: { id: string };
  let engineerRoleA!: { id: string };
  let ownerA!: { id: string; email: string };
  let secondOwnerA!: { id: string; email: string };
  let invitee!: { id: string; email: string };
  let outsider!: { id: string; email: string };

  // A caller WITH tenant context (admin screens).
  function memberCaller(
    user: { id: string; email: string },
    tenantId: string,
    roleKey: string,
  ) {
    const session: SessionInfo = {
      userId: user.id,
      email: user.email,
      activeMembership: {
        membershipId: `m-${run}`,
        tenantId,
        tenantSlug: `slug-${tenantId}`,
        roleKey,
        roleLabel: roleKey,
      },
    };
    return createCaller({ db: app, session } as Context);
  }

  // A caller WITHOUT tenant context — the invitee's situation.
  function tenantlessCaller(user: { id: string; email: string }) {
    const session: SessionInfo = {
      userId: user.id,
      email: user.email,
      activeMembership: null,
    };
    return createCaller({ db: app, session } as Context);
  }

  beforeAll(async () => {
    tenantA = await admin.tenant.create({
      data: { name: `Admin Test A ${run}`, slug: `admin-a-${run}` },
    });
    tenantB = await admin.tenant.create({
      data: { name: `Admin Test B ${run}`, slug: `admin-b-${run}` },
    });
    ownerRoleA = await admin.role.create({
      data: { tenantId: tenantA.id, key: "OWNER_ADMIN", label: "Owner admin" },
    });
    engineerRoleA = await admin.role.create({
      data: { tenantId: tenantA.id, key: "ENGINEER", label: "Engineer" },
    });
    const ownerRoleB = await admin.role.create({
      data: { tenantId: tenantB.id, key: "OWNER_ADMIN", label: "Owner admin" },
    });

    ownerA = await admin.user.create({
      data: { email: `owner-${run}@test.local`, name: "Owner A" },
    });
    secondOwnerA = await admin.user.create({
      data: { email: `owner2-${run}@test.local`, name: "Owner A2" },
    });
    invitee = await admin.user.create({
      data: { email: `invitee-${run}@test.local`, name: "Invitee" },
    });
    outsider = await admin.user.create({
      data: { email: `outsider-${run}@test.local`, name: "Outsider" },
    });

    await admin.membership.create({
      data: { tenantId: tenantA.id, userId: ownerA.id, roleId: ownerRoleA.id },
    });
    await admin.membership.create({
      data: {
        tenantId: tenantB.id,
        userId: outsider.id,
        roleId: ownerRoleB.id,
      },
    });
  });

  afterAll(async () => {
    await admin.tenant.deleteMany({
      where: { id: { in: [tenantA.id, tenantB.id] } },
    });
    await admin.user.deleteMany({
      where: {
        id: { in: [ownerA.id, secondOwnerA.id, invitee.id, outsider.id] },
      },
    });
    await admin.$disconnect();
    await app.$disconnect();
  });

  it("full flow: invite → preview names the firm and role → accept creates the membership → token is single-use", async () => {
    const adminCaller = memberCaller(ownerA, tenantA.id, "OWNER_ADMIN");
    const invitation = await adminCaller.admin.createInvitation({
      email: invitee.email.toUpperCase(), // casing must not matter
      roleId: engineerRoleA.id,
    });
    expect(invitation.email).toBe(invitee.email);
    expect(invitation.token.length).toBeGreaterThan(30);

    // The invitee has a session but NO tenant — the bootstrap path.
    const guest = tenantlessCaller(invitee);
    const preview = await guest.admin.invitationPreview({
      token: invitation.token,
    });
    expect(preview.tenantName).toContain("Admin Test A");
    expect(preview.roleLabel).toBe("Engineer");
    expect(preview.emailMatches).toBe(true);
    expect(preview.status).toBe("PENDING");

    await expect(
      guest.admin.acceptInvitation({ token: invitation.token }),
    ).resolves.toMatchObject({ tenantId: tenantA.id });

    // Membership exists with the invited role.
    const created = await admin.membership.findFirst({
      where: { tenantId: tenantA.id, userId: invitee.id },
      include: { role: { select: { key: true } } },
    });
    expect(created?.role.key).toBe("ENGINEER");

    // Single-use: the same link no longer works.
    await expect(
      guest.admin.acceptInvitation({ token: invitation.token }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    // It shows as ACCEPTED on the admin screen.
    const list = await adminCaller.admin.invitations();
    expect(list.find((i) => i.id === invitation.id)?.status).toBe("ACCEPTED");
  });

  it("denials: wrong email, revoked, expired, already a member of another tenant", async () => {
    const adminCaller = memberCaller(ownerA, tenantA.id, "OWNER_ADMIN");

    // Wrong email — a forwarded link grants nothing.
    const forInvitee = await adminCaller.admin.createInvitation({
      email: `nobody-${run}@test.local`,
      roleId: engineerRoleA.id,
    });
    await expect(
      tenantlessCaller(secondOwnerA).admin.acceptInvitation({
        token: forInvitee.token,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    // …and the preview says so without acting.
    const preview = await tenantlessCaller(
      secondOwnerA,
    ).admin.invitationPreview({ token: forInvitee.token });
    expect(preview.emailMatches).toBe(false);

    // Revoked.
    const toRevoke = await adminCaller.admin.createInvitation({
      email: secondOwnerA.email,
      roleId: engineerRoleA.id,
    });
    await adminCaller.admin.revokeInvitation({ id: toRevoke.id });
    await expect(
      tenantlessCaller(secondOwnerA).admin.acceptInvitation({
        token: toRevoke.token,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      adminCaller.admin.revokeInvitation({ id: toRevoke.id }),
    ).rejects.toMatchObject({ code: "CONFLICT" }); // already terminal

    // Expired (stamped directly, then accepted lazily).
    const stale = await adminCaller.admin.createInvitation({
      email: secondOwnerA.email,
      roleId: engineerRoleA.id,
    });
    await admin.invitation.update({
      where: { id: stale.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(
      tenantlessCaller(secondOwnerA).admin.acceptInvitation({
        token: stale.token,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const afterRead = await adminCaller.admin.invitations();
    expect(afterRead.find((i) => i.id === stale.id)?.status).toBe("EXPIRED");

    // Someone who already belongs to another tenant cannot accept.
    const forOutsider = await adminCaller.admin.createInvitation({
      email: outsider.email,
      roleId: engineerRoleA.id,
    });
    await expect(
      tenantlessCaller(outsider).admin.acceptInvitation({
        token: forOutsider.token,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    // Unknown token → NOT_FOUND, never a leak.
    await expect(
      tenantlessCaller(secondOwnerA).admin.invitationPreview({
        token: "x".repeat(40),
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("re-inviting supersedes the previous pending offer; members cannot be re-invited", async () => {
    const adminCaller = memberCaller(ownerA, tenantA.id, "OWNER_ADMIN");
    const email = `resend-${run}@test.local`;
    const first = await adminCaller.admin.createInvitation({
      email,
      roleId: engineerRoleA.id,
    });
    const second = await adminCaller.admin.createInvitation({
      email,
      roleId: engineerRoleA.id,
    });
    const list = await adminCaller.admin.invitations();
    expect(list.find((i) => i.id === first.id)?.status).toBe("REVOKED");
    expect(list.find((i) => i.id === second.id)?.status).toBe("PENDING");

    // invitee accepted in the first test — inviting them again is refused.
    await expect(
      adminCaller.admin.createInvitation({
        email: invitee.email,
        roleId: engineerRoleA.id,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("last-OWNER_ADMIN guard: cannot demote or remove the only owner; works once a second exists", async () => {
    const adminCaller = memberCaller(ownerA, tenantA.id, "OWNER_ADMIN");
    const members = await adminCaller.admin.members();
    const ownerMembership = members.find((m) => m.user.id === ownerA.id)!;

    await expect(
      adminCaller.admin.changeRole({
        membershipId: ownerMembership.id,
        roleId: engineerRoleA.id,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      adminCaller.admin.removeMember({ membershipId: ownerMembership.id }),
    ).rejects.toMatchObject({ code: "CONFLICT" }); // also: self-removal

    // Promote the invitee to owner-admin, then the guard relaxes.
    const inviteeMembership = members.find((m) => m.user.id === invitee.id)!;
    await adminCaller.admin.changeRole({
      membershipId: inviteeMembership.id,
      roleId: ownerRoleA.id,
    });
    await expect(
      adminCaller.admin.changeRole({
        membershipId: ownerMembership.id,
        roleId: engineerRoleA.id,
      }),
    ).resolves.toMatchObject({ id: ownerMembership.id });
  });

  it("role gate + cross-tenant sweep: engineers are refused; another tenant sees nothing", async () => {
    const engineer = memberCaller(secondOwnerA, tenantA.id, "ENGINEER");
    await expect(engineer.admin.members()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      engineer.admin.createInvitation({
        email: `nope-${run}@test.local`,
        roleId: engineerRoleA.id,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    // Tenant B's admin sees none of tenant A's members or invitations.
    const otherAdmin = memberCaller(outsider, tenantB.id, "OWNER_ADMIN");
    const otherMembers = await otherAdmin.admin.members();
    expect(otherMembers.map((m) => m.user.id)).not.toContain(ownerA.id);
    const otherInvites = await otherAdmin.admin.invitations();
    expect(otherInvites).toHaveLength(0);
    // …and cannot assign tenant A's role.
    await expect(
      otherAdmin.admin.createInvitation({
        email: `cross-${run}@test.local`,
        roleId: engineerRoleA.id,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
