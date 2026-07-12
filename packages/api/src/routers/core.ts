// Andes Core procedures (ADR-003: procedures organized per product).
import {
  protectedProcedure,
  publicProcedure,
  router,
  tenantProcedure,
} from "../trpc.js";
import { clientsRouter, contactsRouter } from "./crm/index.js";
import { proposalsRouter } from "./crm/proposals.js";
import { projectsRouter } from "./projects/index.js";
import { inspectionsRouter } from "./projects/inspections.js";
import { calcRecordsRouter } from "./structures/index.js";
import { geoRecordsRouter } from "./geo/index.js";
import { bimModelsRouter } from "./bim/index.js";

export const coreRouter = router({
  health: publicProcedure.query(() => ({ ok: true as const })),

  // Session as the API sees it — null membership means "authenticated but
  // not yet in a tenant" (awaiting provisioning).
  me: protectedProcedure.query(({ ctx }) => ctx.session),

  // Proof-of-scoping: resolves the caller's tenant through the RLS-scoped
  // client, so both isolation layers are exercised on every call.
  whoami: tenantProcedure.query(async ({ ctx }) => {
    const tenant = await ctx.tenantDb.tenant.findUniqueOrThrow({
      where: { id: ctx.tenantId },
      select: { name: true, slug: true },
    });
    return {
      userId: ctx.session.userId,
      email: ctx.session.email,
      tenantId: ctx.tenantId,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      roleKey: ctx.roleKey,
    };
  }),

  // The tenant's staff — pickers that assign work to people (first use:
  // the inspection inspector, sprint-5.md) read this, never raw users.
  members: tenantProcedure.query(({ ctx }) =>
    ctx.tenantDb.membership.findMany({
      where: { tenantId: ctx.tenantId },
      select: {
        user: { select: { id: true, name: true, email: true } },
        role: { select: { key: true, label: true } },
      },
      orderBy: { user: { name: "asc" } },
    }),
  ),
});

export const appRouter = router({
  core: coreRouter,
  projects: projectsRouter,
  clients: clientsRouter,
  contacts: contactsRouter,
  proposals: proposalsRouter,
  inspections: inspectionsRouter,
  calcRecords: calcRecordsRouter,
  geoRecords: geoRecordsRouter,
  bimModels: bimModelsRouter,
});

export type AppRouter = typeof appRouter;
