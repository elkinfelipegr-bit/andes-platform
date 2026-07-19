// Chunking + section-locator logic for norm ingestion — the validated
// docs_Tec/buscar.py scheme ported to TypeScript (sprint-11.md scope
// item 1). Pure functions; the unit tests are the contract.

// Section locators:
//   NSR-10: C.9.5.2  A.2.4  F.4.7.5.2.1  (letter A–K prefix, optional R)
//   ACI:    25.4.2.3  R25.4.10.2        (chapter 1–27, ≥2 dot groups so
//   decimals like 0.0040 or 12.5 never match)
export const LOCATOR_RE =
  /\b(?:R?[A-K]\.\d+(?:\.\d+)*|R?(?:[1-9]|1\d|2[0-7])\.\d+(?:\.\d+)+)\b/;

export const CHUNK_SIZE = 24;
export const CHUNK_OVERLAP = 8;

export interface NormChunkInput {
  startLine: number; // 1-based, inclusive
  endLine: number; // 1-based, inclusive
  section: string | null;
  content: string;
}

/** Nearest section locator at or above `idx` (0-based line index). */
export function nearestLocator(
  lines: string[],
  idx: number,
  lookBack = 60,
): string | null {
  for (let i = idx; i > Math.max(-1, idx - lookBack); i--) {
    const m = lines[i]?.match(LOCATOR_RE);
    if (m) return m[0];
  }
  return null;
}

/** Sliding windows over the document lines, with stable 1-based coords. */
export function chunkLines(
  lines: string[],
  size = CHUNK_SIZE,
  overlap = CHUNK_OVERLAP,
): NormChunkInput[] {
  const step = Math.max(1, size - overlap);
  const chunks: NormChunkInput[] = [];
  const n = lines.length;
  let i = 0;
  while (i < n) {
    const end = Math.min(n, i + size);
    chunks.push({
      startLine: i + 1,
      endLine: end,
      section: nearestLocator(lines, i),
      content: lines.slice(i, end).join("\n"),
    });
    if (end === n) break;
    i += step;
  }
  return chunks;
}
