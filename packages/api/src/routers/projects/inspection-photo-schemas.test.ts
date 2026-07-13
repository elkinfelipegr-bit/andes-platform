import { describe, expect, it } from "vitest";

import {
  EXTENSION_BY_CONTENT_TYPE,
  MAX_PHOTO_BYTES,
  photoUpdateSchema,
  photoUploadRequestSchema,
} from "./inspection-photo-schemas.js";

describe("photoUploadRequestSchema (ratified whitelist + cap)", () => {
  const valid = {
    inspectionId: "i1",
    fileName: "grieta-eje-3.jpg",
    fileSize: 4 * 1024 * 1024,
    contentType: "image/jpeg" as const,
  };

  it("accepts each whitelisted content type", () => {
    for (const contentType of [
      "image/jpeg",
      "image/png",
      "image/webp",
    ] as const) {
      expect(
        photoUploadRequestSchema.safeParse({ ...valid, contentType }).success,
      ).toBe(true);
    }
  });

  it("rejects everything else — svg, gif, pdf, video", () => {
    for (const contentType of [
      "image/svg+xml",
      "image/gif",
      "application/pdf",
      "video/mp4",
    ]) {
      expect(
        photoUploadRequestSchema.safeParse({ ...valid, contentType }).success,
      ).toBe(false);
    }
  });

  it("enforces the ratified 15 MB cap exactly", () => {
    expect(
      photoUploadRequestSchema.safeParse({
        ...valid,
        fileSize: MAX_PHOTO_BYTES,
      }).success,
    ).toBe(true);
    expect(
      photoUploadRequestSchema.safeParse({
        ...valid,
        fileSize: MAX_PHOTO_BYTES + 1,
      }).success,
    ).toBe(false);
  });

  it("accepts an optional findingId", () => {
    expect(
      photoUploadRequestSchema.safeParse({ ...valid, findingId: "f1" }).success,
    ).toBe(true);
  });

  it("maps every content type to a whitelisted extension", () => {
    expect(EXTENSION_BY_CONTENT_TYPE["image/jpeg"]).toBe("jpg");
    expect(EXTENSION_BY_CONTENT_TYPE["image/png"]).toBe("png");
    expect(EXTENSION_BY_CONTENT_TYPE["image/webp"]).toBe("webp");
  });
});

describe("photoUpdateSchema", () => {
  it("caption and findingId are independently settable and clearable", () => {
    expect(
      photoUpdateSchema.safeParse({ id: "p1", caption: "Grieta" }).success,
    ).toBe(true);
    expect(
      photoUpdateSchema.safeParse({ id: "p1", caption: null }).success,
    ).toBe(true);
    expect(
      photoUpdateSchema.safeParse({ id: "p1", findingId: null }).success,
    ).toBe(true);
  });

  it("caps captions at 500 chars", () => {
    expect(
      photoUpdateSchema.safeParse({ id: "p1", caption: "x".repeat(501) })
        .success,
    ).toBe(false);
  });
});
