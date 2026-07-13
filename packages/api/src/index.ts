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
export { inspectionsRouter } from "./routers/projects/inspections.js";
export {
  INSPECTION_STATUSES,
  FINDING_SEVERITIES,
  inspectionStatusSchema,
  findingSeveritySchema,
  inspectionCreateSchema,
  inspectionUpdateSchema,
} from "./routers/projects/inspection-schemas.js";
export { calcRecordsRouter } from "./routers/structures/index.js";
export {
  CALC_RECORD_STATUSES,
  calcRecordStatusSchema,
  calcRecordCreateSchema,
  calcRecordUpdateSchema,
  checkAddSchema,
  checkUpdateSchema,
} from "./routers/structures/schemas.js";
export { geoRecordsRouter } from "./routers/geo/index.js";
export {
  GEO_RECORD_STATUSES,
  FOOTING_SHAPES,
  geoRecordStatusSchema,
  footingShapeSchema,
  geoRecordCreateSchema,
  geoRecordUpdateSchema,
  bearingCheckAddSchema,
  bearingCheckUpdateSchema,
} from "./routers/geo/schemas.js";
export { bimModelsRouter } from "./routers/bim/index.js";
export {
  BIM_DISCIPLINES,
  BIM_VERSION_STATUSES,
  MAX_UPLOAD_BYTES,
  IFC_CONTENT_TYPE,
  bimDisciplineSchema,
  bimVersionStatusSchema,
  bimModelCreateSchema,
  bimModelUpdateSchema,
  uploadRequestSchema,
} from "./routers/bim/schemas.js";
export { aiRouter } from "./routers/ai/index.js";
export {
  AI_MESSAGE_ROLES,
  aiMessageRoleSchema,
  chatMessageSchema,
  chatRequestSchema,
} from "./routers/ai/schemas.js";
export { COPILOT_SYSTEM_PROMPT } from "./routers/ai/prompt.js";
export {
  copilotTools,
  createCopilotCaller,
  type CopilotCaller,
  type CopilotTool,
} from "./routers/ai/tools.js";
export {
  appendMessage,
  createConversation,
  deriveTitle,
  loadOwnConversation,
  type CopilotSessionCtx,
} from "./routers/ai/service.js";
