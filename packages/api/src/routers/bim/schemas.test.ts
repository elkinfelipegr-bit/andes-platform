import { describe, expect, it } from "vitest";

import {
  bimModelCreateSchema,
  bimModelUpdateSchema,
  MAX_UPLOAD_BYTES,
  uploadRequestSchema,
} from "./schemas.js";

describe("bimModelCreateSchema", () => {
  const valid = {
    projectId: "p1",
    code: "BIM-2026-001",
    title: "Modelo estructural — Torre A",
    discipline: "STRUCTURAL" as const,
  };

  it("accepts a valid model", () => {
    expect(bimModelCreateSchema.parse(valid)).toMatchObject(valid);
  });

  it("trims code and title", () => {
    const parsed = bimModelCreateSchema.parse({
      ...valid,
      code: "  BIM-1  ",
      title: "  T  ",
    });
    expect(parsed.code).toBe("BIM-1");
    expect(parsed.title).toBe("T");
  });

  it("rejects unknown disciplines and empty fields", () => {
    expect(
      bimModelCreateSchema.safeParse({ ...valid, discipline: "NAVAL" }).success,
    ).toBe(false);
    expect(
      bimModelCreateSchema.safeParse({ ...valid, code: "  " }).success,
    ).toBe(false);
    expect(
      bimModelCreateSchema.safeParse({ ...valid, title: "" }).success,
    ).toBe(false);
  });
});

describe("bimModelUpdateSchema", () => {
  it("accepts partial metadata", () => {
    expect(
      bimModelUpdateSchema.parse({ id: "m1", discipline: "MEP" }),
    ).toMatchObject({ id: "m1", discipline: "MEP" });
  });

  it("requires the id", () => {
    expect(bimModelUpdateSchema.safeParse({ title: "X" }).success).toBe(false);
  });
});

describe("uploadRequestSchema (RFC-002 boundary)", () => {
  const valid = {
    bimModelId: "m1",
    fileName: "torre-a-estructural.ifc",
    fileSize: 25 * 1024 * 1024,
  };

  it("accepts a valid IFC upload request", () => {
    expect(uploadRequestSchema.parse(valid)).toMatchObject(valid);
  });

  it("accepts .IFC case-insensitively", () => {
    expect(
      uploadRequestSchema.safeParse({ ...valid, fileName: "MODEL.IFC" })
        .success,
    ).toBe(true);
  });

  it("rejects non-IFC formats — .rvt, .nwd, .gltf, no extension", () => {
    for (const fileName of ["model.rvt", "model.nwd", "model.gltf", "model"]) {
      expect(
        uploadRequestSchema.safeParse({ ...valid, fileName }).success,
      ).toBe(false);
    }
  });

  it("enforces the ratified 300 MB cap exactly", () => {
    expect(
      uploadRequestSchema.safeParse({ ...valid, fileSize: MAX_UPLOAD_BYTES })
        .success,
    ).toBe(true);
    expect(
      uploadRequestSchema.safeParse({
        ...valid,
        fileSize: MAX_UPLOAD_BYTES + 1,
      }).success,
    ).toBe(false);
  });

  it("rejects zero, negative, and fractional sizes", () => {
    for (const fileSize of [0, -1, 10.5]) {
      expect(
        uploadRequestSchema.safeParse({ ...valid, fileSize }).success,
      ).toBe(false);
    }
  });
});
