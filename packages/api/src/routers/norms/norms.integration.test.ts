// Integration tests for the norms router (sprint-11.md testing
// commitments): seeded-fixture relevance incl. accent-insensitivity,
// range reassembly from overlapping chunks, and the inverted-
// enforcement grants test — andes_app must be UNABLE to write reference
// content. Fixture is ingested exactly like ingest-norms does.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chunkLines, PrismaClient } from "@andes/db";

import type { Context, SessionInfo } from "../../context.js";
import { createCallerFactory } from "../../trpc.js";
import { appRouter } from "../core.js";

const APP_URL = process.env.APP_DATABASE_URL;

const FIXTURE_LINES = [
  "TÍTULO A — REQUISITOS GENERALES",
  "A.6.4.1.4 — Cuando se trate de muros de mampostería estructural",
  "debe emplearse el límite de deriva máxima permisible de 0.010h",
  "según se define en este Reglamento para tales sistemas.",
  ...Array.from({ length: 30 }, (_, i) => `relleno técnico línea ${i + 1}`),
  "C.12.2.1 — La longitud de desarrollo a tracción de barras corrugadas",
  "se calcula según las expresiones del presente capítulo.",
  ...Array.from({ length: 10 }, (_, i) => `cierre línea ${i + 1}`),
];

describe.skipIf(!APP_URL)("norms router (integration)", () => {
  const admin = new PrismaClient();
  const app = new PrismaClient({ datasourceUrl: APP_URL });
  const createCaller = createCallerFactory(appRouter);

  const run = randomUUID().slice(0, 8);
  const docKey = `test-nsr-${run}`;
  let tenant!: { id: string };
  let user!: { id: string };

  function caller() {
    const session: SessionInfo = {
      userId: user.id,
      email: `norms-${run}@test.local`,
      activeMembership: {
        membershipId: `m-${run}`,
        tenantId: tenant.id,
        tenantSlug: `slug-${run}`,
        roleKey: "ENGINEER",
        roleLabel: "Engineer",
      },
    };
    const ctx: Context = { db: app, session };
    return createCaller(ctx);
  }

  beforeAll(async () => {
    tenant = await admin.tenant.create({
      data: { name: `Norms Test ${run}`, slug: `norms-${run}` },
    });
    user = await admin.user.create({
      data: { email: `norms-${run}@test.local`, name: "Norms Test User" },
    });
    // Ingest the fixture exactly as ingest-norms does (owner identity).
    const doc = await admin.normDocument.create({
      data: {
        key: docKey,
        title: "Fixture NSR",
        language: "spanish",
        units: "SI",
        lineCount: FIXTURE_LINES.length,
      },
    });
    await admin.normChunk.createMany({
      data: chunkLines(FIXTURE_LINES, 12, 4).map((c) => ({
        documentId: doc.id,
        startLine: c.startLine,
        endLine: c.endLine,
        section: c.section,
        content: c.content,
      })),
    });
    await admin.$executeRawUnsafe(
      `UPDATE "norm_chunk" SET "searchVector" = to_tsvector($1::regconfig, unaccent(content)) WHERE "documentId" = $2`,
      "spanish",
      doc.id,
    );
  });

  afterAll(async () => {
    await admin.normDocument.deleteMany({ where: { key: docKey } });
    await admin.tenant.delete({ where: { id: tenant.id } });
    await admin.user.delete({ where: { id: user.id } });
    await admin.$disconnect();
    await app.$disconnect();
  });

  it("search: accent-insensitive relevance with section citation", async () => {
    // "traccion" (sin tilde) must find "tracción"; section cited.
    const results = await caller().norms.search({
      query: "longitud desarrollo traccion",
      docKey,
      limit: 5,
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.content).toContain("tracción");
    expect(results[0]!.section).toBe("C.12.2.1");
    expect(results[0]!.docKey).toBe(docKey);

    const drift = await caller().norms.search({
      query: "deriva maxima permisible",
      docKey,
    });
    expect(drift[0]!.content).toContain("deriva máxima");
  });

  it("getRange: reassembles exact lines from overlapping chunks", async () => {
    const range = await caller().norms.getRange({
      docKey,
      from: 2,
      to: 4,
    });
    const lines = range.text.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("A.6.4.1.4");
    expect(lines[2]).toContain("según se define");
    // to beyond lineCount clamps
    const clamped = await caller().norms.getRange({
      docKey,
      from: FIXTURE_LINES.length - 1,
      to: FIXTURE_LINES.length + 50,
    });
    expect(clamped.to).toBe(FIXTURE_LINES.length);
  });

  it("listDocuments exposes the catalog; unknown doc in getRange is NOT_FOUND", async () => {
    const docs = await caller().norms.listDocuments();
    expect(docs.map((d) => d.key)).toContain(docKey);
    await expect(
      caller().norms.getRange({ docKey: "no-such-doc", from: 1, to: 2 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("inverted enforcement: andes_app cannot write reference content (strict tier)", async () => {
    await expect(
      app.normDocument.create({
        data: {
          key: `evil-${run}`,
          title: "Evil",
          language: "spanish",
          units: "SI",
          lineCount: 1,
        },
      }),
    ).rejects.toThrow();
    await expect(
      app.normChunk.deleteMany({ where: { section: "C.12.2.1" } }),
    ).rejects.toThrow();
    // …but reading as the app role works (the whole point).
    const count = await app.normChunk.count();
    expect(count).toBeGreaterThan(0);
  });
});
