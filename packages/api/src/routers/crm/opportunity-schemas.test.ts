import { describe, expect, it } from "vitest";

import {
  activityLogSchema,
  isOpenStage,
  opportunityCreateSchema,
  opportunitySetStageSchema,
  opportunityUpdateSchema,
} from "./opportunity-schemas.js";

describe("opportunityCreateSchema", () => {
  it("accepts the minimum: a client and a title", () => {
    const parsed = opportunityCreateSchema.parse({
      clientId: "c1",
      title: "  Diseño estructural bodega  ",
    });
    expect(parsed.title).toBe("Diseño estructural bodega");
  });

  it("rejects an empty title, negative value and malformed day", () => {
    expect(
      opportunityCreateSchema.safeParse({ clientId: "c1", title: " " }).success,
    ).toBe(false);
    expect(
      opportunityCreateSchema.safeParse({
        clientId: "c1",
        title: "x",
        estimatedValue: -1,
      }).success,
    ).toBe(false);
    for (const nextActionAt of ["13/11/2026", "2026-13-40", "tomorrow"]) {
      expect(
        opportunityCreateSchema.safeParse({
          clientId: "c1",
          title: "x",
          nextActionAt,
        }).success,
      ).toBe(false);
    }
  });
});

describe("opportunityUpdateSchema", () => {
  it("lets nullable fields be cleared and carries no clientId or stage", () => {
    const parsed = opportunityUpdateSchema.parse({
      id: "o1",
      estimatedValue: null,
      nextAction: null,
      nextActionAt: null,
      clientId: "other",
      stage: "WON",
    });
    expect(parsed.estimatedValue).toBeNull();
    expect("clientId" in parsed).toBe(false);
    expect("stage" in parsed).toBe(false);
  });
});

describe("opportunitySetStageSchema", () => {
  it("requires a reason to lose, and only to lose", () => {
    expect(
      opportunitySetStageSchema.safeParse({ id: "o1", stage: "LOST" }).success,
    ).toBe(false);
    expect(
      opportunitySetStageSchema.safeParse({
        id: "o1",
        stage: "LOST",
        lostReason: "  ",
      }).success,
    ).toBe(false);
    expect(
      opportunitySetStageSchema.safeParse({
        id: "o1",
        stage: "LOST",
        lostReason: "Precio",
      }).success,
    ).toBe(true);
    expect(
      opportunitySetStageSchema.safeParse({ id: "o1", stage: "WON" }).success,
    ).toBe(true);
  });

  it("rejects stages outside the enum", () => {
    expect(
      opportunitySetStageSchema.safeParse({ id: "o1", stage: "ARCHIVED" })
        .success,
    ).toBe(false);
  });
});

describe("activityLogSchema", () => {
  it("defaults to a note and requires a body", () => {
    expect(
      activityLogSchema.parse({ opportunityId: "o1", body: "Llamé" }).type,
    ).toBe("NOTE");
    expect(
      activityLogSchema.safeParse({ opportunityId: "o1", body: "" }).success,
    ).toBe(false);
  });
});

describe("isOpenStage", () => {
  it("treats only WON and LOST as closed", () => {
    expect(isOpenStage("LEAD")).toBe(true);
    expect(isOpenStage("NEGOTIATION")).toBe(true);
    expect(isOpenStage("WON")).toBe(false);
    expect(isOpenStage("LOST")).toBe(false);
  });
});
