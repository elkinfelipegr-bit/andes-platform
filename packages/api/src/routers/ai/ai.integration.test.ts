// Integration tests for the AI Module — conversation CRUD with BOTH
// sweeps the domain model mandates at the strict tier: cross-tenant
// (as every module) and cross-USER within the same tenant (the first
// user-private records). Also proves the copilot tools ride the same
// tenant scoping as the procedures they wrap. The model boundary is
// not touched here (mocked out of existence — RFC-003/ADR-009).
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { forTenant, PrismaClient } from "@andes/db";

import type { Context, SessionInfo } from "../../context.js";
import { createCallerFactory } from "../../trpc.js";
import { appRouter } from "../core.js";
import {
  appendMessage,
  createConversation,
  loadOwnConversation,
  type CopilotSessionCtx,
} from "./service.js";
import { copilotTools, createCopilotCaller } from "./tools.js";

const APP_URL = process.env.APP_DATABASE_URL;

describe.skipIf(!APP_URL)("ai router + copilot service (integration)", () => {
  const admin = new PrismaClient();
  const app = new PrismaClient({ datasourceUrl: APP_URL });
  const createCaller = createCallerFactory(appRouter);

  const run = randomUUID().slice(0, 8);
  let tenantA!: { id: string };
  let tenantB!: { id: string };
  let userOne!: { id: string };
  let userTwo!: { id: string };

  function ctxFor(tenantId: string, userId: string): Context {
    const session: SessionInfo = {
      userId,
      email: `ai-${userId}-${run}@test.local`,
      activeMembership: {
        membershipId: `m-${run}`,
        tenantId,
        tenantSlug: `slug-${tenantId}`,
        roleKey: "ENGINEER",
        roleLabel: "Engineer",
      },
    };
    return { db: app, session };
  }

  function serviceCtx(tenantId: string, userId: string): CopilotSessionCtx {
    return { tenantDb: forTenant(app, tenantId), tenantId, userId };
  }

  beforeAll(async () => {
    tenantA = await admin.tenant.create({
      data: { name: `AI Test A ${run}`, slug: `ai-a-${run}` },
    });
    tenantB = await admin.tenant.create({
      data: { name: `AI Test B ${run}`, slug: `ai-b-${run}` },
    });
    userOne = await admin.user.create({
      data: { email: `ai-one-${run}@test.local`, name: "AI User One" },
    });
    userTwo = await admin.user.create({
      data: { email: `ai-two-${run}@test.local`, name: "AI User Two" },
    });
  });

  afterAll(async () => {
    await admin.tenant.deleteMany({
      where: { id: { in: [tenantA.id, tenantB.id] } },
    });
    await admin.user.deleteMany({
      where: { id: { in: [userOne.id, userTwo.id] } },
    });
    await admin.$disconnect();
    await app.$disconnect();
  });

  it("conversation lifecycle: create → append turns → list/get by owner → delete cascades", async () => {
    const ctx = serviceCtx(tenantA.id, userOne.id);
    const conversation = await createConversation(
      ctx,
      "¿Qué propuestas siguen abiertas para Constructora XYZ?",
    );
    expect(conversation.title).toContain("¿Qué propuestas");

    await appendMessage(ctx, conversation.id, "USER", "¿Qué propuestas…?");
    await appendMessage(ctx, conversation.id, "ASSISTANT", "Encontré 2…");

    const loaded = await loadOwnConversation(ctx, conversation.id);
    expect(loaded?.messages.map((m) => m.role)).toEqual(["USER", "ASSISTANT"]);
    expect(loaded?.messages.map((m) => m.position)).toEqual([0, 1]);

    const caller = createCaller(ctxFor(tenantA.id, userOne.id));
    const listed = await caller.ai.listConversations();
    expect(listed.map((c) => c.id)).toContain(conversation.id);

    await expect(
      caller.ai.deleteConversation({ id: conversation.id }),
    ).resolves.toMatchObject({ id: conversation.id });
    // Cascade: messages gone with it.
    const orphanMessages = await forTenant(app, tenantA.id).aiMessage.count({
      where: { conversationId: conversation.id },
    });
    expect(orphanMessages).toBe(0);
  });

  it("owner privacy: a same-tenant colleague cannot list, read, or delete another user's conversation", async () => {
    const ctx = serviceCtx(tenantA.id, userOne.id);
    const conversation = await createConversation(ctx, "Privada de One");
    await appendMessage(ctx, conversation.id, "USER", "secreto");

    const colleague = createCaller(ctxFor(tenantA.id, userTwo.id));
    const listed = await colleague.ai.listConversations();
    expect(listed.map((c) => c.id)).not.toContain(conversation.id);
    await expect(
      colleague.ai.getConversation({ id: conversation.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      colleague.ai.deleteConversation({ id: conversation.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    // Service-layer load is owner-verified too (the chat route's path).
    expect(
      await loadOwnConversation(
        serviceCtx(tenantA.id, userTwo.id),
        conversation.id,
      ),
    ).toBeNull();

    // The owner still sees it.
    const owner = createCaller(ctxFor(tenantA.id, userOne.id));
    await expect(
      owner.ai.getConversation({ id: conversation.id }),
    ).resolves.toMatchObject({ id: conversation.id });
  });

  it("cross-tenant sweep: conversations are invisible across tenants", async () => {
    const ctx = serviceCtx(tenantA.id, userOne.id);
    const conversation = await createConversation(ctx, "Solo tenant A");

    const outsider = createCaller(ctxFor(tenantB.id, userOne.id));
    const listed = await outsider.ai.listConversations();
    expect(listed.map((c) => c.id)).not.toContain(conversation.id);
    await expect(
      outsider.ai.getConversation({ id: conversation.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      outsider.ai.deleteConversation({ id: conversation.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("copilot tools ride the caller's tenant scoping: listProjects returns only the session tenant's projects", async () => {
    const callerA = createCopilotCaller(ctxFor(tenantA.id, userOne.id));
    const projectA = await callerA.projects.create({
      code: `PAI-${run}`,
      name: "Proyecto del copiloto",
    });
    const listProjects = copilotTools.find((t) => t.name === "listProjects")!;

    const seenFromA = (await listProjects.execute(callerA, {})) as Array<{
      id: string;
    }>;
    expect(seenFromA.map((p) => p.id)).toContain(projectA.id);

    const callerB = createCopilotCaller(ctxFor(tenantB.id, userOne.id));
    const seenFromB = (await listProjects.execute(callerB, {})) as Array<{
      id: string;
    }>;
    expect(seenFromB.map((p) => p.id)).not.toContain(projectA.id);

    // Malformed tool input fails at the schema boundary, before any query.
    const getProject = copilotTools.find((t) => t.name === "getProject")!;
    await expect(getProject.execute(callerA, {})).rejects.toThrow();
  });
});
