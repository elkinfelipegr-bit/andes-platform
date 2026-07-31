// Administration procedures (sprint-12.md scope item 2; ADR-003).
// Everything here is OWNER_ADMIN-only (the Sprint 2 archive precedent)
// EXCEPT acceptInvitation, which any authenticated session may attempt
// against a token it holds — that is the whole point of an invite.
//
// The last-OWNER_ADMIN guard is the safety rule: a tenant must never be
// able to lock itself out of its own account.
import { randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { forInviteToken, forTenant, forUser, Prisma } from "@andes/db";

import {
  protectedProcedure,
  roleProcedure,
  router,
  tenantProcedure,
} from "../../trpc.js";
import {
  changeRoleSchema,
  createInvitationSchema,
  invitationIdSchema,
  inviteTokenSchema,
  INVITE_TTL_DAYS,
  membershipIdSchema,
} from "./schemas.js";

const adminProcedure = roleProcedure("OWNER_ADMIN");

const OWNER_ADMIN = "OWNER_ADMIN";

function newToken(): string {
  // 32 bytes of entropy, URL-safe — the link is the credential.
  return randomBytes(32).toString("base64url");
}

function expiryFromNow(): Date {
  return new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
}

interface TenantDbLike {
  membership: {
    count(args: object): Promise<number>;
    findFirst(args: object): Promise<unknown>;
  };
}

// Refuses any change that would leave the tenant without an OWNER_ADMIN.
async function assertNotLastOwnerAdmin(
  tenantDb: TenantDbLike,
  tenantId: string,
  membershipId: string,
) {
  const membership = (await tenantDb.membership.findFirst({
    where: { id: membershipId, tenantId },
    include: { role: { select: { key: true } } },
  })) as { role: { key: string } } | null;
  if (!membership) throw new TRPCError({ code: "NOT_FOUND" });
  if (membership.role.key !== OWNER_ADMIN) return;

  const owners = await tenantDb.membership.count({
    where: { tenantId, role: { key: OWNER_ADMIN } },
  });
  if (owners <= 1) {
    throw new TRPCError({
      code: "CONFLICT",
      message:
        "This is the tenant's last owner-admin — promote someone else first.",
    });
  }
}

export const adminRouter = router({
  // ── Members ───────────────────────────────────────────────────────────
  members: adminProcedure.query(({ ctx }) =>
    ctx.tenantDb.membership.findMany({
      where: { tenantId: ctx.tenantId },
      select: {
        id: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
        role: { select: { id: true, key: true, label: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ),

  // The tenant's own role catalogue — roles are data (Sprint 0), so this
  // screen never needs a migration to offer a new one.
  roles: adminProcedure.query(({ ctx }) =>
    ctx.tenantDb.role.findMany({
      where: { tenantId: ctx.tenantId },
      select: { id: true, key: true, label: true },
      orderBy: { key: "asc" },
    }),
  ),

  changeRole: adminProcedure
    .input(changeRoleSchema)
    .mutation(async ({ ctx, input }) => {
      const role = await ctx.tenantDb.role.findFirst({
        where: { id: input.roleId, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (!role) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Role does not belong to this tenant.",
        });
      }
      await assertNotLastOwnerAdmin(
        ctx.tenantDb,
        ctx.tenantId,
        input.membershipId,
      );
      await ctx.tenantDb.membership.updateMany({
        where: { id: input.membershipId, tenantId: ctx.tenantId },
        data: { roleId: input.roleId },
      });
      return { id: input.membershipId };
    }),

  removeMember: adminProcedure
    .input(membershipIdSchema)
    .mutation(async ({ ctx, input }) => {
      const membership = await ctx.tenantDb.membership.findFirst({
        where: { id: input.membershipId, tenantId: ctx.tenantId },
        select: { userId: true },
      });
      if (!membership) throw new TRPCError({ code: "NOT_FOUND" });
      if (membership.userId === ctx.session.userId) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You cannot remove your own membership.",
        });
      }
      await assertNotLastOwnerAdmin(
        ctx.tenantDb,
        ctx.tenantId,
        input.membershipId,
      );
      await ctx.tenantDb.membership.deleteMany({
        where: { id: input.membershipId, tenantId: ctx.tenantId },
      });
      return { id: input.membershipId };
    }),

  // ── Invitations ───────────────────────────────────────────────────────
  invitations: adminProcedure.query(async ({ ctx }) => {
    // Lazy expiry (ratified: no cron) — stamp overdue rows on read.
    await ctx.tenantDb.invitation.updateMany({
      where: {
        tenantId: ctx.tenantId,
        status: "PENDING",
        expiresAt: { lt: new Date() },
      },
      data: { status: "EXPIRED" },
    });
    return ctx.tenantDb.invitation.findMany({
      where: { tenantId: ctx.tenantId },
      select: {
        id: true,
        email: true,
        status: true,
        token: true,
        expiresAt: true,
        createdAt: true,
        role: { select: { key: true, label: true } },
        invitedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  createInvitation: adminProcedure
    .input(createInvitationSchema)
    .mutation(async ({ ctx, input }) => {
      const role = await ctx.tenantDb.role.findFirst({
        where: { id: input.roleId, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (!role) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Role does not belong to this tenant.",
        });
      }
      // Already a member? Inviting again would be a no-op at best.
      const existing = await ctx.tenantDb.membership.findFirst({
        where: { tenantId: ctx.tenantId, user: { email: input.email } },
        select: { id: true },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "That email is already a member of this tenant.",
        });
      }
      // Re-inviting supersedes the previous pending offer (ratified).
      await ctx.tenantDb.invitation.updateMany({
        where: {
          tenantId: ctx.tenantId,
          email: input.email,
          status: "PENDING",
        },
        data: { status: "REVOKED" },
      });
      return ctx.tenantDb.invitation.create({
        data: {
          tenantId: ctx.tenantId,
          email: input.email,
          roleId: input.roleId,
          token: newToken(),
          expiresAt: expiryFromNow(),
          invitedById: ctx.session.userId,
        },
        select: {
          id: true,
          email: true,
          token: true,
          expiresAt: true,
          status: true,
          role: { select: { key: true, label: true } },
        },
      });
    }),

  revokeInvitation: adminProcedure
    .input(invitationIdSchema)
    .mutation(async ({ ctx, input }) => {
      const revoked = await ctx.tenantDb.invitation.updateMany({
        where: { id: input.id, tenantId: ctx.tenantId, status: "PENDING" },
        data: { status: "REVOKED" },
      });
      if (revoked.count === 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Only pending invitations can be revoked.",
        });
      }
      return { id: input.id };
    }),

  // ── Acceptance (no tenant context yet — the bootstrap path) ───────────

  // What the accept screen shows before the user commits: which firm and
  // which role, read through the token-scoped client only.
  invitationPreview: protectedProcedure
    .input(inviteTokenSchema)
    .query(async ({ ctx, input }) => {
      const scoped = forInviteToken(ctx.db, input.token);
      const invitation = await scoped.invitation.findFirst({
        where: { token: input.token },
        select: {
          email: true,
          status: true,
          expiresAt: true,
          tenant: { select: { name: true, slug: true } },
          role: { select: { key: true, label: true } },
        },
      });
      if (!invitation) throw new TRPCError({ code: "NOT_FOUND" });
      const expired =
        invitation.status === "EXPIRED" || invitation.expiresAt < new Date();
      return {
        tenantName: invitation.tenant.name,
        roleLabel: invitation.role.label,
        email: invitation.email,
        // Whether THIS session may accept — the UI explains before acting.
        emailMatches:
          invitation.email === ctx.session.email.trim().toLowerCase(),
        status: expired ? ("EXPIRED" as const) : invitation.status,
      };
    }),

  acceptInvitation: protectedProcedure
    .input(inviteTokenSchema)
    .mutation(async ({ ctx, input }) => {
      const scoped = forInviteToken(ctx.db, input.token);
      const invitation = await scoped.invitation.findFirst({
        where: { token: input.token },
        select: {
          id: true,
          tenantId: true,
          email: true,
          roleId: true,
          status: true,
          expiresAt: true,
        },
      });
      if (!invitation) throw new TRPCError({ code: "NOT_FOUND" });

      // Bound to the invited email: a forwarded link grants nothing.
      if (invitation.email !== ctx.session.email.trim().toLowerCase()) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `This invitation was issued to ${invitation.email}. Sign in with that address to accept it.`,
        });
      }
      if (invitation.status !== "PENDING") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This invitation is no longer available.",
        });
      }
      if (invitation.expiresAt < new Date()) {
        // Lazy expiry, stamped under the invitation's own tenant scope.
        await forTenant(ctx.db, invitation.tenantId).invitation.updateMany({
          where: { id: invitation.id },
          data: { status: "EXPIRED" },
        });
        throw new TRPCError({
          code: "CONFLICT",
          message: "This invitation has expired — ask for a new one.",
        });
      }

      // One active tenant per user (Sprint 0 / RFC-001). Read through
      // forUser: the unscoped client sees nothing under RLS (fails
      // closed), which would silently wave every existing member through.
      const existing = await forUser(
        ctx.db,
        ctx.session.userId,
      ).membership.findFirst({
        where: { userId: ctx.session.userId },
        select: { tenantId: true },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            existing.tenantId === invitation.tenantId
              ? "You already belong to this tenant."
              : "You already belong to another tenant.",
        });
      }

      // Token validated → act inside the invitation's own tenant scope.
      // No write path widened: this is ordinary tenant-scoped writing.
      const tenantDb = forTenant(ctx.db, invitation.tenantId);
      try {
        await tenantDb.membership.create({
          data: {
            tenantId: invitation.tenantId,
            userId: ctx.session.userId,
            roleId: invitation.roleId,
          },
        });
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "You already belong to this tenant.",
          });
        }
        throw e;
      }
      // Single-use: consumed even if the same link is opened again.
      await tenantDb.invitation.updateMany({
        where: { id: invitation.id, status: "PENDING" },
        data: {
          status: "ACCEPTED",
          acceptedByUserId: ctx.session.userId,
          acceptedAt: new Date(),
        },
      });
      return { tenantId: invitation.tenantId };
    }),

  // Convenience for the shell: does this session already have a tenant?
  myMembership: tenantProcedure.query(({ ctx }) => ({
    tenantId: ctx.tenantId,
    roleKey: ctx.roleKey,
  })),
});
