export type { Context, SessionInfo } from "./context.js";
export {
  router,
  createCallerFactory,
  publicProcedure,
  protectedProcedure,
  tenantProcedure,
  roleProcedure,
} from "./trpc.js";
export { createContext } from "./session.js";
export { appRouter, coreRouter, type AppRouter } from "./routers/core.js";
export { projectsRouter } from "./routers/projects/index.js";
export { clientsRouter, contactsRouter } from "./routers/crm/index.js";
export {
  PROJECT_STATUSES,
  projectStatusSchema,
  projectCreateSchema,
  projectUpdateSchema,
} from "./routers/projects/schemas.js";
export {
  clientCreateSchema,
  clientUpdateSchema,
  contactCreateSchema,
  contactUpdateSchema,
} from "./routers/crm/schemas.js";
export { proposalsRouter } from "./routers/crm/proposals.js";
export {
  PROPOSAL_STATUSES,
  proposalStatusSchema,
  proposalCreateSchema,
  proposalUpdateSchema,
  proposalItemInputSchema,
} from "./routers/crm/proposal-schemas.js";
export { proposalTotal } from "./routers/crm/proposal-total.js";
