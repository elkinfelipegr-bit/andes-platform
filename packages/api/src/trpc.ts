// Shared tRPC middleware chain (ADR-003, RFC-001 layer 1): no tenant-scoped
// procedure runs without a tenantId from the authenticated session. This is
// the enforcement point RFC-001 mandates be "shared middleware, not
// per-procedure discipline".
import { initTRPC, TRPCError } from "@trpc/server";
import { forTenant } from "@andes/db";

import type { Context } from "./context.js";

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;

export const publicProcedure = t.procedure;

// Requires an authenticated session; narrows ctx.session to non-null.
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { session: ctx.session } });
});

// Requires tenant membership. Downstream resolvers receive:
//  - ctx.tenantId / ctx.roleKey — for explicit application-layer scoping
//  - ctx.tenantDb — RLS-scoped client (RFC-001 layer 2 backstop): every
//    query through it runs with app.tenant_id set, so even a resolver that
//    forgets a where-clause cannot read another tenant's rows.
export const tenantProcedure = protectedProcedure.use(({ ctx, next }) => {
  const membership = ctx.session.activeMembership;
  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "No active tenant membership.",
    });
  }
  return next({
    ctx: {
      tenantId: membership.tenantId,
      roleKey: membership.roleKey,
      tenantDb: forTenant(ctx.db, membership.tenantId),
    },
  });
});

// Role-level gate on top of tenant scoping — Sprint 0 checks roles, not
// fine-grained permissions (deferred per sprint-0-domain-model.md).
export function roleProcedure(...allowedRoleKeys: string[]) {
  return tenantProcedure.use(({ ctx, next }) => {
    if (!allowedRoleKeys.includes(ctx.roleKey)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Requires one of roles: ${allowedRoleKeys.join(", ")}.`,
      });
    }
    return next();
  });
}
