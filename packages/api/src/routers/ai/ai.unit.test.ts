import { describe, expect, it } from "vitest";

import { COPILOT_SYSTEM_PROMPT } from "./prompt.js";
import { chatRequestSchema } from "./schemas.js";
import { deriveTitle } from "./service.js";
import { copilotTools } from "./tools.js";

describe("copilotTools (RFC-003 read-only tool set)", () => {
  it("covers the six live modules with list/get pairs (14 tools)", () => {
    expect(copilotTools).toHaveLength(14);
  });

  it("has unique, read-only names (list*/get* only — the judgment boundary by construction)", () => {
    const names = copilotTools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      expect(name).toMatch(/^(list|get)[A-Z]/);
    }
  });

  it("every tool has a non-empty description and a parsable empty/id input", () => {
    for (const tool of copilotTools) {
      expect(tool.description.length).toBeGreaterThan(20);
      const sample = tool.name.startsWith("get") ? { id: "some-id" } : {};
      expect(tool.inputSchema.safeParse(sample).success).toBe(true);
    }
  });

  it("rejects malformed inputs at the tool boundary", () => {
    const getProject = copilotTools.find((t) => t.name === "getProject")!;
    expect(getProject.inputSchema.safeParse({}).success).toBe(false);
    const listProjects = copilotTools.find((t) => t.name === "listProjects")!;
    expect(
      listProjects.inputSchema.safeParse({ status: "BOGUS" }).success,
    ).toBe(false);
  });
});

describe("COPILOT_SYSTEM_PROMPT (policy constants)", () => {
  it("encodes the judgment boundary and grounding rules", () => {
    expect(COPILOT_SYSTEM_PROMPT).toContain("THE ENGINEER DECIDES");
    expect(COPILOT_SYSTEM_PROMPT).toContain("READ-ONLY");
    expect(COPILOT_SYSTEM_PROMPT).toContain("never invent records");
    expect(COPILOT_SYSTEM_PROMPT).toContain(
      "reviewed, decided, and signed by the responsible engineer",
    );
  });
});

describe("chatRequestSchema", () => {
  it("accepts a message with or without a conversation id", () => {
    expect(chatRequestSchema.safeParse({ message: "hola" }).success).toBe(true);
    expect(
      chatRequestSchema.safeParse({ conversationId: "c1", message: "hola" })
        .success,
    ).toBe(true);
  });

  it("rejects empty and oversized messages", () => {
    expect(chatRequestSchema.safeParse({ message: "  " }).success).toBe(false);
    expect(
      chatRequestSchema.safeParse({ message: "x".repeat(4001) }).success,
    ).toBe(false);
  });
});

describe("deriveTitle", () => {
  it("compacts whitespace and caps at 60 chars with an ellipsis", () => {
    expect(deriveTitle("  ¿Qué   propuestas\nsiguen abiertas?  ")).toBe(
      "¿Qué propuestas siguen abiertas?",
    );
    const long = deriveTitle("x".repeat(100));
    expect(long.length).toBe(60);
    expect(long.endsWith("…")).toBe(true);
  });
});
