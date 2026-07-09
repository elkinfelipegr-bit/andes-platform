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
});

export const appRouter = router({
  core: coreRouter,
  projects: projectsRouter,
  clients: clientsRouter,
  contacts: contactsRouter,
  proposals: proposalsRouter,
});

export type AppRouter = typeof appRouter;
