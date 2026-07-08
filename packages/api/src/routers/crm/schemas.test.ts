// Unit tests for the CRM Zod schemas — required tier per PROJECT_RULES.md.
import { describe, expect, it } from "vitest";

import {
  clientCreateSchema,
  clientListSchema,
  clientUpdateSchema,
  contactCreateSchema,
  contactUpdateSchema,
} from "./schemas.js";

describe("clientCreateSchema", () => {
  it("trims and rejects empty names", () => {
    expect(clientCreateSchema.parse({ name: " ACME " }).name).toBe("ACME");
    expect(clientCreateSchema.safeParse({ name: "  " }).success).toBe(false);
  });

  it("accepts enrichment fields; taxId stays free text (ratified decision 3)", () => {
    const parsed = clientCreateSchema.parse({
      name: "ACME",
      taxId: "900.123.456-7",
      industry: "Construction",
      city: "Bogotá",
      email: "contacto@acme.co",
    });
    expect(parsed.taxId).toBe("900.123.456-7");
  });

  it("rejects malformed emails", () => {
    expect(
      clientCreateSchema.safeParse({ name: "ACME", email: "not-an-email" })
        .success,
    ).toBe(false);
  });
});

describe("clientUpdateSchema", () => {
  it("requires id and accepts explicit nulls to clear fields", () => {
    expect(clientUpdateSchema.safeParse({}).success).toBe(false);
    const parsed = clientUpdateSchema.parse({
      id: "c1",
      taxId: null,
      notes: null,
    });
    expect(parsed.taxId).toBeNull();
    expect(parsed.notes).toBeNull();
  });
});

describe("clientListSchema", () => {
  it("accepts undefined, empty, and the includeArchived flag", () => {
    expect(clientListSchema.safeParse(undefined).success).toBe(true);
    expect(clientListSchema.safeParse({}).success).toBe(true);
    expect(clientListSchema.safeParse({ includeArchived: true }).success).toBe(
      true,
    );
  });
});

describe("contactCreateSchema", () => {
  it("requires clientId and name; trims", () => {
    expect(contactCreateSchema.safeParse({ name: "Ana" }).success).toBe(false);
    const parsed = contactCreateSchema.parse({
      clientId: "c1",
      name: " Ana Ruiz ",
      title: "Interventora",
    });
    expect(parsed.name).toBe("Ana Ruiz");
  });

  it("rejects malformed contact emails", () => {
    expect(
      contactCreateSchema.safeParse({
        clientId: "c1",
        name: "Ana",
        email: "nope",
      }).success,
    ).toBe(false);
  });
});

describe("contactUpdateSchema", () => {
  it("requires id and accepts nulls to clear optional fields", () => {
    expect(contactUpdateSchema.safeParse({ name: "x" }).success).toBe(false);
    const parsed = contactUpdateSchema.parse({
      id: "ct1",
      title: null,
      phone: null,
    });
    expect(parsed.title).toBeNull();
  });
});
