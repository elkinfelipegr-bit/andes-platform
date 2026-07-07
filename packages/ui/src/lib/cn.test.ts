import { describe, expect, it } from "vitest";

import { cn } from "./cn.js";

describe("cn", () => {
  it("merges conditional class lists", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });

  it("resolves conflicting Tailwind classes in favor of the last", () => {
    expect(cn("p-4", "p-2")).toBe("p-2");
    expect(cn("bg-primary", "bg-destructive")).toBe("bg-destructive");
  });
});
