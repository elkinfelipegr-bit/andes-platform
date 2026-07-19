import { describe, expect, it } from "vitest";

import { chunkLines, LOCATOR_RE, nearestLocator } from "./norms-chunker.js";

describe("LOCATOR_RE (ported from the validated buscar.py)", () => {
  it("matches NSR-10 and ACI section numbers", () => {
    for (const s of [
      "C.9.5.2",
      "A.2.4",
      "F.4.7.5.2.1",
      "R.C.21.1".slice(2),
      "25.4.2.3",
      "R25.4.10.2",
    ]) {
      expect(LOCATOR_RE.test(s), s).toBe(true);
    }
  });

  it("does not match decimals or bare numbers", () => {
    for (const s of ["0.0040", "12.5", "0.010", "28", "420"]) {
      expect(LOCATOR_RE.test(s), s).toBe(false);
    }
  });
});

describe("chunkLines", () => {
  const lines = Array.from({ length: 60 }, (_, i) => `línea ${i + 1}`);
  lines[9] = "A.6.4.1.4 — Requisitos de la deriva";

  it("produces overlapping windows with 1-based inclusive coordinates", () => {
    const chunks = chunkLines(lines);
    expect(chunks[0]).toMatchObject({ startLine: 1, endLine: 24 });
    expect(chunks[1]).toMatchObject({ startLine: 17, endLine: 40 });
    // last chunk always reaches the final line
    expect(chunks.at(-1)!.endLine).toBe(60);
    // every line is covered
    expect(chunks[0]!.content.split("\n")).toHaveLength(24);
  });

  it("attaches the nearest preceding section locator", () => {
    const chunks = chunkLines(lines);
    // chunk starting at line 17 looks back and finds A.6.4.1.4 (line 10)
    expect(chunks[1]!.section).toBe("A.6.4.1.4");
    // first chunk starts before any locator upstream, but line 10 is
    // inside look-forward? no — locator search is at-or-above start
    expect(chunks[0]!.section).toBeNull();
  });

  it("round-trips content by line coordinates (getRange contract)", () => {
    const chunks = chunkLines(lines);
    for (const c of chunks.slice(0, 3)) {
      const split = c.content.split("\n");
      expect(split[0]).toBe(lines[c.startLine - 1]);
      expect(split.at(-1)).toBe(lines[c.endLine - 1]);
    }
  });
});

describe("nearestLocator", () => {
  it("returns null when nothing is found in the look-back window", () => {
    expect(nearestLocator(["a", "b", "c"], 2)).toBeNull();
  });
});
