// Unit tests for the Proposal Zod schemas — required tier per
// PROJECT_RULES.md.
import { describe, expect, it } from "vitest";

import {
  proposalConvertSchema,
  proposalCreateSchema,
  proposalDecideSchema,
  proposalItemInputSchema,
  proposalUpdateSchema,
} from "./proposal-schemas.js";

describe("proposalItemInputSchema", () => {
  it("accepts a priced line and rejects non-positive quantity or negative price", () => {
    expect(
      proposalItemInputSchema.safeParse({
        description: "Diseño estructural",
        quantity: 450,
        unit: "m²",
        unitPrice: 12000,
      }).success,
    ).toBe(true);
    expect(
      proposalItemInputSchema.safeParse({
        description: "x",
        quantity: 0,
        unit: "un",
        unitPrice: 1,
      }).success,
    ).toBe(false);
    expect(
      proposalItemInputSchema.safeParse({
        description: "x",
        quantity: 1,
        unit: "un",
        unitPrice: -1,
      }).success,
    ).toBe(false);
  });
});

describe("proposalCreateSchema", () => {
  it("requires clientId, code, title; items default to empty", () => {
    const parsed = proposalCreateSchema.parse({
      clientId: "c1",
      code: " PR-2026-001 ",
      title: "Estudio de suelos",
    });
    expect(parsed.code).toBe("PR-2026-001");
    expect(parsed.items).toEqual([]);
    expect(
      proposalCreateSchema.safeParse({ code: "x", title: "y" }).success,
    ).toBe(false);
  });

  it("enforces 3-letter currency and coerces validUntil", () => {
    expect(
      proposalCreateSchema.safeParse({
        clientId: "c1",
        code: "P",
        title: "t",
        currency: "PESOS",
      }).success,
    ).toBe(false);
    const parsed = proposalCreateSchema.parse({
      clientId: "c1",
      code: "P",
      title: "t",
      currency: "USD",
      validUntil: "2026-08-31",
    });
    expect(parsed.validUntil).toBeInstanceOf(Date);
  });
});

describe("proposalUpdateSchema", () => {
  it("requires id; contactId/scope/validUntil accept null to clear", () => {
    expect(proposalUpdateSchema.safeParse({}).success).toBe(false);
    const parsed = proposalUpdateSchema.parse({
      id: "p1",
      contactId: null,
      scope: null,
      validUntil: null,
    });
    expect(parsed.contactId).toBeNull();
  });

  it("has no clientId — a proposal's client is immutable", () => {
    const parsed = proposalUpdateSchema.parse({
      id: "p1",
      clientId: "other",
    } as never);
    expect("clientId" in parsed).toBe(false);
  });
});

describe("proposalDecideSchema / proposalConvertSchema", () => {
  it("decision is only ACCEPTED or REJECTED", () => {
    expect(
      proposalDecideSchema.safeParse({ id: "p", decision: "ACCEPTED" }).success,
    ).toBe(true);
    expect(
      proposalDecideSchema.safeParse({ id: "p", decision: "EXPIRED" }).success,
    ).toBe(false);
  });

  it("conversion requires a project code", () => {
    expect(proposalConvertSchema.safeParse({ id: "p" }).success).toBe(false);
    expect(
      proposalConvertSchema.safeParse({ id: "p", projectCode: "P-2026-014" })
        .success,
    ).toBe(true);
  });
});
