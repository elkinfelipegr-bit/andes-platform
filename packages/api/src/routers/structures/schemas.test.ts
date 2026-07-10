// Unit tests for the Structures Zod schemas — required tier per
// PROJECT_RULES.md.
import { describe, expect, it } from "vitest";

import {
  calcRecordCreateSchema,
  calcRecordListSchema,
  calcRecordUpdateSchema,
  checkAddSchema,
  checkUpdateSchema,
} from "./schemas.js";

describe("calcRecordCreateSchema", () => {
  it("requires project, code, title, and in-range materials", () => {
    const parsed = calcRecordCreateSchema.parse({
      projectId: "p1",
      code: " MC-2026-001 ",
      title: "Memoria edificio norte",
      fc: 21,
      fy: 420,
    });
    expect(parsed.code).toBe("MC-2026-001");
    expect(parsed.designCode).toBeUndefined(); // DB defaults NSR-10
    expect(
      calcRecordCreateSchema.safeParse({
        projectId: "p1",
        code: "MC",
        title: "t",
        fc: 10, // below 17 MPa
        fy: 420,
      }).success,
    ).toBe(false);
    expect(
      calcRecordCreateSchema.safeParse({
        projectId: "p1",
        code: "MC",
        title: "t",
        fc: 21,
        fy: 800, // above 700 MPa
      }).success,
    ).toBe(false);
  });
});

describe("calcRecordUpdateSchema", () => {
  it("requires id; has no projectId — a record belongs to its project", () => {
    expect(calcRecordUpdateSchema.safeParse({}).success).toBe(false);
    const parsed = calcRecordUpdateSchema.parse({
      id: "r1",
      projectId: "other",
      notes: null,
    } as never);
    expect("projectId" in parsed).toBe(false);
    expect(parsed.notes).toBeNull();
  });
});

describe("checkAddSchema / checkUpdateSchema", () => {
  it("requires record, label, and positive geometry", () => {
    expect(
      checkAddSchema.safeParse({
        calcRecordId: "r1",
        label: "Viga eje 3",
        b: 300,
        h: 500,
        cover: 60,
        mu: 120,
      }).success,
    ).toBe(true);
    expect(
      checkAddSchema.safeParse({
        calcRecordId: "r1",
        label: "x",
        b: 0,
        h: 500,
        cover: 60,
        mu: 120,
      }).success,
    ).toBe(false);
    expect(
      checkAddSchema.safeParse({
        calcRecordId: "r1",
        label: "x",
        b: 300,
        h: 500,
        cover: 60,
        mu: -5,
      }).success,
    ).toBe(false);
  });

  it("update requires id and accepts partial geometry", () => {
    expect(checkUpdateSchema.safeParse({ label: "x" }).success).toBe(false);
    expect(checkUpdateSchema.safeParse({ id: "c1", mu: 150 }).success).toBe(
      true,
    );
  });
});

describe("calcRecordListSchema", () => {
  it("accepts undefined and valid filters", () => {
    expect(calcRecordListSchema.safeParse(undefined).success).toBe(true);
    expect(
      calcRecordListSchema.safeParse({ projectId: "p1", status: "ISSUED" })
        .success,
    ).toBe(true);
    expect(calcRecordListSchema.safeParse({ status: "FINAL" }).success).toBe(
      false,
    );
  });
});
