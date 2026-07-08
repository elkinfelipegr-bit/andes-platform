// Unit tests for the Projects Zod schemas — required tier per
// PROJECT_RULES.md (validation schemas are always unit-tested).
import { describe, expect, it } from "vitest";

import {
  projectCreateSchema,
  projectListSchema,
  projectUpdateSchema,
} from "./schemas.js";

describe("projectCreateSchema", () => {
  it("accepts a minimal valid project and trims strings", () => {
    const parsed = projectCreateSchema.parse({
      code: "  P-2026-001  ",
      name: "  Edificio Norte  ",
    });
    expect(parsed.code).toBe("P-2026-001");
    expect(parsed.name).toBe("Edificio Norte");
    expect(parsed.status).toBeUndefined();
  });

  it("rejects empty code and name", () => {
    expect(projectCreateSchema.safeParse({ code: "", name: "x" }).success).toBe(
      false,
    );
    expect(
      projectCreateSchema.safeParse({ code: "P-1", name: "   " }).success,
    ).toBe(false);
  });

  it("rejects ARCHIVED as a settable status — that is the archive procedure's job", () => {
    expect(
      projectCreateSchema.safeParse({
        code: "P-1",
        name: "x",
        status: "ARCHIVED",
      }).success,
    ).toBe(false);
    expect(
      projectCreateSchema.safeParse({
        code: "P-1",
        name: "x",
        status: "ACTIVE",
      }).success,
    ).toBe(true);
  });

  it("coerces ISO date strings and rejects endDate before startDate", () => {
    const ok = projectCreateSchema.parse({
      code: "P-1",
      name: "x",
      startDate: "2026-01-01",
      endDate: "2026-06-30",
    });
    expect(ok.startDate).toBeInstanceOf(Date);
    expect(
      projectCreateSchema.safeParse({
        code: "P-1",
        name: "x",
        startDate: "2026-06-30",
        endDate: "2026-01-01",
      }).success,
    ).toBe(false);
  });
});

describe("projectUpdateSchema", () => {
  it("requires id and accepts partial fields including explicit nulls", () => {
    expect(projectUpdateSchema.safeParse({}).success).toBe(false);
    const parsed = projectUpdateSchema.parse({
      id: "p1",
      clientId: null,
      description: null,
    });
    expect(parsed.clientId).toBeNull();
    expect(parsed.description).toBeNull();
  });

  it("rejects ARCHIVED via update", () => {
    expect(
      projectUpdateSchema.safeParse({ id: "p1", status: "ARCHIVED" }).success,
    ).toBe(false);
  });
});

describe("projectListSchema", () => {
  it("accepts undefined, empty object, and a valid status filter", () => {
    expect(projectListSchema.safeParse(undefined).success).toBe(true);
    expect(projectListSchema.safeParse({}).success).toBe(true);
    expect(projectListSchema.safeParse({ status: "ARCHIVED" }).success).toBe(
      true,
    );
    expect(projectListSchema.safeParse({ status: "BOGUS" }).success).toBe(
      false,
    );
  });
});

// clientCreateSchema tests moved to ../crm/schemas.test.ts (Sprint 3).
