// Unit tests for total computation — money/calculation logic is mandatory
// unit-test tier per PROJECT_RULES.md.
import { describe, expect, it } from "vitest";

import { proposalTotal } from "./proposal-total.js";

describe("proposalTotal", () => {
  it("sums quantity × unitPrice across items", () => {
    expect(
      proposalTotal([
        { quantity: 450, unitPrice: 12000 },
        { quantity: 1, unitPrice: 3_500_000 },
      ]),
    ).toBe(450 * 12000 + 3_500_000);
  });

  it("is exact where float math would drift", () => {
    // 0.1 * 0.2 * 3 style drift: floats give 2189999.9999999998-ish sums.
    expect(
      proposalTotal([
        { quantity: 0.1, unitPrice: 21_900_000 },
        { quantity: 0.2, unitPrice: 0.1 },
      ]),
    ).toBe(2_190_000.02);
  });

  it("returns 0 for an empty draft", () => {
    expect(proposalTotal([])).toBe(0);
  });

  it("accepts string/Decimal inputs as Prisma returns them", () => {
    expect(proposalTotal([{ quantity: "2.50", unitPrice: "1000.10" }])).toBe(
      2500.25,
    );
  });
});
