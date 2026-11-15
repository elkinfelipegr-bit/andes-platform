import { describe, expect, it } from "vitest";

import { isValidIntakeKey, leadIntakeSchema } from "./lead.js";

const KEY = "k".repeat(40);

describe("isValidIntakeKey", () => {
  it("accepts only the exact bearer key", () => {
    expect(isValidIntakeKey(`Bearer ${KEY}`, KEY)).toBe(true);
    expect(isValidIntakeKey(`Bearer ${KEY}x`, KEY)).toBe(false);
    expect(isValidIntakeKey(`Bearer ${"j".repeat(40)}`, KEY)).toBe(false);
    expect(isValidIntakeKey(KEY, KEY)).toBe(false);
    expect(isValidIntakeKey(`Basic ${KEY}`, KEY)).toBe(false);
    expect(isValidIntakeKey(null, KEY)).toBe(false);
  });

  it("is closed when the server key is unset or too short", () => {
    expect(isValidIntakeKey("Bearer ", undefined)).toBe(false);
    expect(isValidIntakeKey("Bearer undefined", undefined)).toBe(false);
    expect(isValidIntakeKey("Bearer short", "short")).toBe(false);
    expect(isValidIntakeKey("Bearer ", "")).toBe(false);
  });
});

describe("leadIntakeSchema", () => {
  const base = { name: "Ana", subject: "Diseño", message: "Hola" };

  it("accepts the minimum and normalises the email", () => {
    expect(leadIntakeSchema.safeParse(base).success).toBe(true);
    expect(
      leadIntakeSchema.parse({ ...base, email: "  Ana@Example.COM " }).email,
    ).toBe("ana@example.com");
  });

  it("rejects empty, oversized and malformed fields", () => {
    expect(leadIntakeSchema.safeParse({ ...base, name: " " }).success).toBe(
      false,
    );
    expect(
      leadIntakeSchema.safeParse({ ...base, message: "x".repeat(4001) })
        .success,
    ).toBe(false);
    expect(
      leadIntakeSchema.safeParse({ ...base, email: "not-an-email" }).success,
    ).toBe(false);
  });

  it("drops fields it does not know — a caller cannot choose the tenant", () => {
    const parsed = leadIntakeSchema.parse({
      ...base,
      tenantId: "other",
      ownerId: "someone",
      stage: "WON",
    });
    expect(Object.keys(parsed).sort()).toEqual(["message", "name", "subject"]);
  });
});
