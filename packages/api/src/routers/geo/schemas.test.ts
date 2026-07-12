// Unit tests for the Geo Zod schemas — required tier per PROJECT_RULES.md.
import { describe, expect, it } from "vitest";

import {
  bearingCheckAddSchema,
  bearingCheckUpdateSchema,
  geoRecordCreateSchema,
  geoRecordListSchema,
  geoRecordUpdateSchema,
} from "./schemas.js";

describe("geoRecordCreateSchema", () => {
  it("requires project, code, title", () => {
    const parsed = geoRecordCreateSchema.parse({
      projectId: "p1",
      code: " EG-2026-001 ",
      title: "Estudio geotécnico edificio norte",
    });
    expect(parsed.code).toBe("EG-2026-001");
    expect(
      geoRecordCreateSchema.safeParse({ code: "EG", title: "t" }).success,
    ).toBe(false);
  });
});

describe("geoRecordUpdateSchema", () => {
  it("requires id; has no projectId — a record belongs to its project", () => {
    expect(geoRecordUpdateSchema.safeParse({}).success).toBe(false);
    const parsed = geoRecordUpdateSchema.parse({
      id: "r1",
      projectId: "other",
      notes: null,
    } as never);
    expect("projectId" in parsed).toBe(false);
    expect(parsed.notes).toBeNull();
  });
});

describe("bearingCheckAddSchema", () => {
  const valid = {
    geoRecordId: "r1",
    label: "Zapata Z-1",
    b: 1.5,
    df: 1.5,
    gamma: 18,
    c: 0,
    phi: 30,
    fs: 3,
    shape: "STRIP" as const,
  };

  it("accepts a valid footing situation incl. surface footing (df=0)", () => {
    expect(bearingCheckAddSchema.safeParse(valid).success).toBe(true);
    expect(bearingCheckAddSchema.safeParse({ ...valid, df: 0 }).success).toBe(
      true,
    );
  });

  it("rejects out-of-range soil parameters, FS, and unknown shapes", () => {
    expect(
      bearingCheckAddSchema.safeParse({ ...valid, gamma: 3 }).success,
    ).toBe(false);
    expect(bearingCheckAddSchema.safeParse({ ...valid, phi: 55 }).success).toBe(
      false,
    );
    expect(bearingCheckAddSchema.safeParse({ ...valid, fs: 0.5 }).success).toBe(
      false,
    );
    expect(
      bearingCheckAddSchema.safeParse({ ...valid, shape: "CIRCULAR" }).success,
    ).toBe(false);
  });
});

describe("bearingCheckUpdateSchema / geoRecordListSchema", () => {
  it("update requires id and accepts partial inputs", () => {
    expect(bearingCheckUpdateSchema.safeParse({ phi: 25 }).success).toBe(false);
    expect(
      bearingCheckUpdateSchema.safeParse({ id: "c1", phi: 25, shape: "SQUARE" })
        .success,
    ).toBe(true);
  });

  it("list accepts undefined and valid filters", () => {
    expect(geoRecordListSchema.safeParse(undefined).success).toBe(true);
    expect(
      geoRecordListSchema.safeParse({ projectId: "p1", status: "ISSUED" })
        .success,
    ).toBe(true);
    expect(geoRecordListSchema.safeParse({ status: "FINAL" }).success).toBe(
      false,
    );
  });
});
