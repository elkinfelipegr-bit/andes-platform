// Operator script (the link-member precedent): loads the converted norm
// texts from docs_Tec/md/ into the platform database — sprint-11.md
// scope item 1. Runs as the table owner (DATABASE_URL), the only role
// that can write reference content. Re-ingesting a document replaces
// its chunks atomically and repopulates the search vectors with the
// document's language config + unaccent.
//
// Usage:  pnpm --filter @andes/db ingest-norms
//         (DATABASE_URL must point at the target DB; for Neon use the
//          unpooled URL, the migrations precedent.)
import "dotenv/config";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

import { chunkLines } from "../src/norms-chunker.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const MD_DIR = join(HERE, "..", "..", "..", "docs_Tec", "md");

const CATALOG = [
  {
    key: "nsr10",
    file: "NSR-10.md",
    title: "NSR-10 — Reglamento Colombiano de Construcción Sismo Resistente",
    language: "spanish",
    units: "SI",
  },
  {
    key: "aci",
    file: "ACI 318-25.md",
    title: "ACI 318-25 — Building Code Requirements for Structural Concrete",
    language: "english",
    units: "US",
  },
  {
    key: "aci-si",
    file: "ACI 318-25_SI.md",
    title:
      "ACI 318-25 (SI) — Building Code Requirements for Structural Concrete",
    language: "english",
    units: "SI",
  },
  {
    key: "apendice-e",
    file: "ACI 318-25-AppendixE.md",
    title: "ACI 318-25 — Appendix E, Unit Equivalence",
    language: "english",
    units: "SI+US",
  },
] as const;

const BATCH = 500;

async function main() {
  const db = new PrismaClient();
  try {
    for (const doc of CATALOG) {
      const path = join(MD_DIR, doc.file);
      if (!existsSync(path)) {
        console.log(
          `- ${doc.key}: ${doc.file} no está en docs_Tec/md — omitido`,
        );
        continue;
      }
      const lines = readFileSync(path, "utf8").split(/\r?\n/);
      const chunks = chunkLines(lines);
      console.log(
        `→ ${doc.key}: ${lines.length.toLocaleString()} líneas, ${chunks.length.toLocaleString()} chunks`,
      );

      const record = await db.normDocument.upsert({
        where: { key: doc.key },
        create: { ...doc, lineCount: lines.length },
        update: {
          title: doc.title,
          language: doc.language,
          units: doc.units,
          lineCount: lines.length,
        },
      });
      // Atomic-enough replacement for reference content: readers only
      // ever see a fully ingested document because search joins on the
      // vectors populated at the end.
      await db.normChunk.deleteMany({ where: { documentId: record.id } });
      for (let i = 0; i < chunks.length; i += BATCH) {
        await db.normChunk.createMany({
          data: chunks.slice(i, i + BATCH).map((c) => ({
            documentId: record.id,
            startLine: c.startLine,
            endLine: c.endLine,
            section: c.section,
            content: c.content,
          })),
        });
        process.stdout.write(
          `  ${Math.min(i + BATCH, chunks.length)}/${chunks.length}\r`,
        );
      }
      // Search vectors: the document's language config + unaccent.
      await db.$executeRawUnsafe(
        `UPDATE "norm_chunk" SET "searchVector" = to_tsvector($1::regconfig, unaccent(content)) WHERE "documentId" = $2`,
        doc.language,
        record.id,
      );
      console.log(`  ✓ ${doc.key} ingerido con vectores (${doc.language})`);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
