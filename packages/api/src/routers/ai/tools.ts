// The Copilot's read-only tool set (RFC-003 choice 1): thin adapters
// over the SIX live modules' existing list/get procedures, executed
// through a regular tRPC caller built from the asking user's own
// context — both RFC-001 isolation layers apply unchanged, and the
// model can never see anything the user couldn't open on screen.
// Read-only by construction: only list/get procedures are referenced.
import { z } from "zod";

import type { Context } from "../../context.js";
import { createCallerFactory } from "../../trpc.js";
import { appRouter } from "../core.js";

const createCaller = createCallerFactory(appRouter);

export type CopilotCaller = ReturnType<typeof createCaller>;

export function createCopilotCaller(ctx: Context): CopilotCaller {
  return createCaller(ctx);
}

export interface CopilotTool {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  execute: (caller: CopilotCaller, input: unknown) => Promise<unknown>;
}

// One controlled cast per tool, hidden here, so every definition below
// stays fully typed against its own schema.
function defineTool<S extends z.ZodTypeAny>(
  name: string,
  description: string,
  inputSchema: S,
  execute: (caller: CopilotCaller, input: z.infer<S>) => Promise<unknown>,
): CopilotTool {
  return {
    name,
    description,
    inputSchema,
    execute: (caller, input) => execute(caller, inputSchema.parse(input)),
  };
}

const id = z.object({ id: z.string().min(1).describe("The record's id") });

export const copilotTools: CopilotTool[] = [
  defineTool(
    "listProjects",
    "List the firm's projects (code, name, client, status, dates). Optionally filter by status: DRAFT, ACTIVE, ON_HOLD, COMPLETED, ARCHIVED.",
    z.object({
      status: z
        .enum(["DRAFT", "ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"])
        .optional(),
    }),
    (caller, input) => caller.projects.list(input.status ? input : undefined),
  ),
  defineTool(
    "getProject",
    "Get one project with its client and the summaries of everything attached: inspections, calculation records, geotechnical records, BIM models.",
    id,
    (caller, input) => caller.projects.get(input),
  ),
  defineTool(
    "listClients",
    "List the firm's clients (active by default; set includeArchived to include archived ones).",
    z.object({ includeArchived: z.boolean().optional() }),
    (caller, input) => caller.clients.list(input),
  ),
  defineTool(
    "getClient",
    "Get one client with its contacts, projects, and proposals.",
    id,
    (caller, input) => caller.clients.get(input),
  ),
  defineTool(
    "listProposals",
    "List commercial proposals. Optionally filter by status: DRAFT, SENT, ACCEPTED, REJECTED, EXPIRED.",
    z.object({
      status: z
        .enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"])
        .optional(),
    }),
    (caller, input) => caller.proposals.list(input.status ? input : undefined),
  ),
  defineTool(
    "getProposal",
    "Get one proposal with its line items and computed totals.",
    id,
    (caller, input) => caller.proposals.get(input),
  ),
  defineTool(
    "listInspections",
    "List site inspections. Optional filters: projectId, status (SCHEDULED, COMPLETED, CANCELLED).",
    z.object({
      projectId: z.string().min(1).optional(),
      status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]).optional(),
    }),
    (caller, input) =>
      caller.inspections.list(
        input.projectId || input.status ? input : undefined,
      ),
  ),
  defineTool(
    "getInspection",
    "Get one inspection with its findings (severity, description, location).",
    id,
    (caller, input) => caller.inspections.get(input),
  ),
  defineTool(
    "listCalcRecords",
    "List structural calculation records (memorias de cálculo). Optional filters: projectId, status (DRAFT, ISSUED).",
    z.object({
      projectId: z.string().min(1).optional(),
      status: z.enum(["DRAFT", "ISSUED"]).optional(),
    }),
    (caller, input) =>
      caller.calcRecords.list(
        input.projectId || input.status ? input : undefined,
      ),
  ),
  defineTool(
    "getCalcRecord",
    "Get one structural calculation record: design criteria (f'c, fy, design code) and every beam flexure check with its stored inputs AND computed outputs (d, rho bounds, required As, verdict). Use this to explain what was calculated.",
    id,
    (caller, input) => caller.calcRecords.get(input),
  ),
  defineTool(
    "listGeoRecords",
    "List geotechnical records (estudios). Optional filters: projectId, status (DRAFT, ISSUED).",
    z.object({
      projectId: z.string().min(1).optional(),
      status: z.enum(["DRAFT", "ISSUED"]).optional(),
    }),
    (caller, input) =>
      caller.geoRecords.list(
        input.projectId || input.status ? input : undefined,
      ),
  ),
  defineTool(
    "getGeoRecord",
    "Get one geotechnical record: every bearing capacity check with its stored inputs (B, Df, soil parameters, FS, shape) AND computed outputs (Vesic factors, qUlt, qAdm in kPa). Use this to explain what was calculated.",
    id,
    (caller, input) => caller.geoRecords.get(input),
  ),
  defineTool(
    "listBimModels",
    "List BIM models. Optional filters: projectId, discipline (ARCHITECTURE, STRUCTURAL, MEP, SITE, OTHER).",
    z.object({
      projectId: z.string().min(1).optional(),
      discipline: z
        .enum(["ARCHITECTURE", "STRUCTURAL", "MEP", "SITE", "OTHER"])
        .optional(),
    }),
    (caller, input) =>
      caller.bimModels.list(
        input.projectId || input.discipline ? input : undefined,
      ),
  ),
  defineTool(
    "getBimModel",
    "Get one BIM model with its immutable version history (file names, sizes, uploaders, dates).",
    id,
    (caller, input) => caller.bimModels.get(input),
  ),
];
