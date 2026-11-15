// Integration tests for the follow-up digest (ADR-012). No session on
// this path: strict tier — a digest for tenant A must contain nothing of
// tenant B, even when the same user is the owner in both.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@andes/db";

import { buildFollowUpDigests } from "./digest.js";

const APP_URL = process.env.APP_DATABASE_URL;

describe.skipIf(!APP_URL)("follow-up digest (integration)", () => {
  const admin = new PrismaClient();
  const app = new PrismaClient({ datasourceUrl: APP_URL });
  const run = randomUUID().slice(0, 8);
  const today = "2026-11-16";
  const day = (d: string) => new Date(`${d}T00:00:00Z`);
  let tenantA!: { id: string };
  let tenantB!: { id: string };
  let ana!: { id: string };
  let luis!: { id: string };
  let idle!: { id: string };

  beforeAll(async () => {
    const mkTenant = (tag: string) =>
      admin.tenant.create({
        data: { name: `Dig ${tag} ${run}`, slug: `dig-${tag}-${run}` },
      });
    tenantA = await mkTenant("a");
    tenantB = await mkTenant("b");
    const mkUser = (tag: string) =>
      admin.user.create({
        data: { email: `dig-${tag}-${run}@test.local`, name: `Dig ${tag}` },
      });
    ana = await mkUser("ana");
    luis = await mkUser("luis");
    idle = await mkUser("idle");
    const roleA = await admin.role.create({
      data: { tenantId: tenantA.id, key: "ENGINEER", label: "Engineer" },
    });
    await admin.membership.createMany({
      data: [ana, luis, idle].map((u) => ({
        tenantId: tenantA.id,
        userId: u.id,
        roleId: roleA.id,
      })),
    });

    const seed = async (tenantId: string, tag: string) => {
      const client = await admin.client.create({
        data: { tenantId, name: `Cliente ${tag}` },
      });
      const opp = (
        title: string,
        ownerId: string,
        over: {
          stage?: "LEAD" | "QUOTED" | "WON";
          nextActionAt?: Date;
          nextAction?: string;
        } = {},
      ) =>
        admin.opportunity.create({
          data: {
            tenantId,
            clientId: client.id,
            title: `${title} ${tag}`,
            ownerId,
            createdById: ownerId,
            ...over,
          },
        });
      await opp("Vencida", ana.id, {
        nextActionAt: day("2026-11-13"),
        nextAction: "Llamar",
      });
      await opp("Hoy", ana.id, { nextActionAt: day(today) });
      await opp("Futura", ana.id, { nextActionAt: day("2026-11-20") });
      await opp("Sin paso", luis.id);
      await opp("Ganada", ana.id, {
        stage: "WON",
        nextActionAt: day("2026-11-01"),
      });
      const quoted = await opp("Cotizada", luis.id, {
        stage: "QUOTED",
        nextActionAt: day("2026-11-25"),
      });
      await admin.proposal.create({
        data: {
          tenantId,
          clientId: client.id,
          opportunityId: quoted.id,
          code: `DG-${tag}-${run}`,
          title: "Propuesta",
          status: "SENT",
          sentAt: new Date("2026-11-12T15:00:00Z"),
          createdById: luis.id,
        },
      });
    };
    await seed(tenantA.id, "A");
    // Same owners, same shape, in a tenant they are NOT members of.
    await seed(tenantB.id, "B");
  });

  afterAll(async () => {
    await admin.tenant.deleteMany({
      where: { id: { in: [tenantA.id, tenantB.id] } },
    });
    await admin.user.deleteMany({
      where: { id: { in: [ana.id, luis.id, idle.id] } },
    });
    await admin.$disconnect();
    await app.$disconnect();
  });

  it("gives each member only their own pending items, classified against today", async () => {
    const digests = await buildFollowUpDigests(app, tenantA.id, today);
    // The member with nothing pending gets no email.
    expect(digests.map((d) => d.userId).sort()).toEqual(
      [ana.id, luis.id].sort(),
    );

    const a = digests.find((d) => d.userId === ana.id)!;
    expect(a.due.map((i) => [i.title, i.daysLate])).toEqual([
      ["Vencida A", 3],
      ["Hoy A", 0],
    ]);
    expect(a.due[0]?.nextAction).toBe("Llamar");
    expect(a.unplanned).toEqual([]);
    expect(a.quotes).toEqual([]);

    const l = digests.find((d) => d.userId === luis.id)!;
    expect(l.due).toEqual([]);
    expect(l.unplanned.map((u) => u.title)).toEqual(["Sin paso A"]);
    expect(l.quotes).toHaveLength(1);
    expect(l.quotes[0]).toMatchObject({
      code: `DG-A-${run}`,
      client: "Cliente A",
      daysWaiting: 4,
    });
  });

  it("contains nothing of another tenant, and yields nothing for a tenant without members", async () => {
    const digests = await buildFollowUpDigests(app, tenantA.id, today);
    const flat = JSON.stringify(digests);
    expect(flat).not.toContain(" B");
    expect(flat).not.toContain(`DG-B-${run}`);
    // Tenant B has the data but no memberships: no recipients, no digest.
    expect(await buildFollowUpDigests(app, tenantB.id, today)).toEqual([]);
    expect(await buildFollowUpDigests(app, `nope-${run}`, today)).toEqual([]);
  });
});
