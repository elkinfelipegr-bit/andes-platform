// Unit tests for the Inspection Zod schemas — required tier per
// PROJECT_RULES.md.
import { describe, expect, it } from "vitest";

import {
  findingInputSchema,
  inspectionCreateSchema,
  inspectionListSchema,
  inspectionUpdateSchema,
} from "./inspection-schemas.js";

describe("findingInputSchema", () => {
  it("requires description and a valid severity", () => {
    expect(
      findingInputSchema.safeParse({
        description: "Fisura en viga eje 3",
        severity: "HIGH",
        location: "Piso 2",
      }).success,
    ).toBe(true);
    expect(
      findingInputSchema.safeParse({ description: "x", severity: "URGENT" })
        .success,
    ).toBe(false);
    expect(
      findingInputSchema.safeParse({ description: "  ", severity: "LOW" })
        .success,
    ).toBe(false);
  });
});

describe("inspectionCreateSchema", () => {
  it("requires project, inspector, code, title, and coerces scheduledFor", () => {
    const parsed = inspectionCreateSchema.parse({
      projectId: "p1",
      inspectorId: "u1",
      code: " INS-2026-001 ",
      title: "Visita de interventoría",
      scheduledFor: "2026-08-01",
    });
    expect(parsed.code).toBe("INS-2026-001");
    expect(parsed.scheduledFor).toBeInstanceOf(Date);
    expect(
      inspectionCreateSchema.safeParse({
        projectId: "p1",
        code: "I",
        title: "t",
        scheduledFor: "2026-08-01",
      }).success,
    ).toBe(false);
  });
});

describe("inspectionUpdateSchema", () => {
  it("requires id; has no projectId — an inspection belongs to its project", () => {
    expect(inspectionUpdateSchema.safeParse({}).success).toBe(false);
    const parsed = inspectionUpdateSchema.parse({
      id: "i1",
      projectId: "other",
      notes: null,
    } as never);
    expect("projectId" in parsed).toBe(false);
    expect(parsed.notes).toBeNull();
  });

  it("accepts a findings replacement set", () => {
    const parsed = inspectionUpdateSchema.parse({
      id: "i1",
      findings: [
        { description: "Acero expuesto", severity: "CRITICAL" },
        { description: "Humedad leve", severity: "LOW", location: "Sótano" },
      ],
    });
    expect(parsed.findings).toHaveLength(2);
  });
});

describe("inspectionListSchema", () => {
  it("accepts undefined, project filter, and status filter", () => {
    expect(inspectionListSchema.safeParse(undefined).success).toBe(true);
    expect(
      inspectionListSchema.safeParse({ projectId: "p1", status: "SCHEDULED" })
        .success,
    ).toBe(true);
    expect(inspectionListSchema.safeParse({ status: "DONE" }).success).toBe(
      false,
    );
  });
});
