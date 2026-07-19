import { describe, expect, it } from "vitest";

import { normsRangeSchema, normsSearchSchema } from "./schemas.js";

describe("normsSearchSchema", () => {
  it("accepts a query with defaults and optional doc filter", () => {
    expect(normsSearchSchema.parse({ query: "deriva máxima" })).toMatchObject({
      query: "deriva máxima",
      limit: 8,
    });
    expect(
      normsSearchSchema.safeParse({ query: "cortante", docKey: "nsr10" })
        .success,
    ).toBe(true);
  });

  it("rejects empty/oversized queries and out-of-range limits", () => {
    expect(normsSearchSchema.safeParse({ query: " " }).success).toBe(false);
    expect(
      normsSearchSchema.safeParse({ query: "x".repeat(201) }).success,
    ).toBe(false);
    expect(
      normsSearchSchema.safeParse({ query: "ok", limit: 21 }).success,
    ).toBe(false);
  });
});

describe("normsRangeSchema (copyright guard)", () => {
  it("accepts an ascending range up to 200 lines", () => {
    expect(
      normsRangeSchema.safeParse({ docKey: "nsr10", from: 100, to: 300 })
        .success,
    ).toBe(true);
  });

  it("rejects descending or over-long ranges — no whole-document pulls", () => {
    expect(
      normsRangeSchema.safeParse({ docKey: "nsr10", from: 300, to: 100 })
        .success,
    ).toBe(false);
    expect(
      normsRangeSchema.safeParse({ docKey: "nsr10", from: 1, to: 202 }).success,
    ).toBe(false);
  });
});
