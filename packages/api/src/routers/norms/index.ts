// Norms Reference procedures (sprint-11.md scope item 2; ADR-003).
// Platform-scoped reference content: any authenticated member reads;
// nobody writes through the app (the norms_grants migration makes that
// structural, not conventional). Queries go through ctx.db directly —
// there is no tenant column to scope; tenantProcedure still gates
// access to members only. Search is PostgreSQL FTS with the document's
// language config + unaccent, matching how ingestion built the vectors.
import { TRPCError } from "@trpc/server";
import { Prisma } from "@andes/db";

import { router, tenantProcedure } from "../../trpc.js";
import { normsRangeSchema, normsSearchSchema } from "./schemas.js";

export interface SearchRow {
  id: string;
  docKey: string;
  docTitle: string;
  startLine: number;
  endLine: number;
  section: string | null;
  content: string;
  rank: number;
}

export const normsRouter = router({
  listDocuments: tenantProcedure.query(({ ctx }) =>
    ctx.db.normDocument.findMany({
      select: {
        key: true,
        title: true,
        language: true,
        units: true,
        lineCount: true,
      },
      orderBy: { key: "asc" },
    }),
  ),

  search: tenantProcedure
    .input(normsSearchSchema)
    .query(async ({ ctx, input }) => {
      const docFilter = input.docKey ?? null;
      // websearch_to_tsquery parses free text safely (no tsquery syntax
      // errors from user input); unaccent mirrors the ingested vectors.
      const rows = await ctx.db.$queryRaw<SearchRow[]>(Prisma.sql`
        SELECT
          c.id,
          d.key            AS "docKey",
          d.title          AS "docTitle",
          c."startLine",
          c."endLine",
          c.section,
          c.content,
          ts_rank(
            c."searchVector",
            websearch_to_tsquery(d.language::regconfig, unaccent(${input.query}))
          )::float8 AS rank
        FROM "norm_chunk" c
        JOIN "norm_document" d ON d.id = c."documentId"
        WHERE c."searchVector" @@
          websearch_to_tsquery(d.language::regconfig, unaccent(${input.query}))
          AND (${docFilter}::text IS NULL OR d.key = ${docFilter})
        ORDER BY rank DESC, d.key ASC, c."startLine" ASC
        LIMIT ${input.limit}
      `);
      return rows;
    }),

  // One exact passage, reassembled from the overlapping chunks by line
  // coordinates (span ≤ 200 lines — schema-enforced).
  getRange: tenantProcedure
    .input(normsRangeSchema)
    .query(async ({ ctx, input }) => {
      const document = await ctx.db.normDocument.findUnique({
        where: { key: input.docKey },
        select: { id: true, key: true, title: true, lineCount: true },
      });
      if (!document) throw new TRPCError({ code: "NOT_FOUND" });
      const from = Math.min(input.from, document.lineCount);
      const to = Math.min(input.to, document.lineCount);

      const chunks = await ctx.db.normChunk.findMany({
        where: {
          documentId: document.id,
          startLine: { lte: to },
          endLine: { gte: from },
        },
        orderBy: { startLine: "asc" },
        select: { startLine: true, content: true },
      });
      // Chunks overlap; rebuild unique lines by absolute coordinate.
      const byLine = new Map<number, string>();
      for (const chunk of chunks) {
        chunk.content.split("\n").forEach((line, offset) => {
          byLine.set(chunk.startLine + offset, line);
        });
      }
      const lines: string[] = [];
      for (let n = from; n <= to; n++) lines.push(byLine.get(n) ?? "");
      return {
        docKey: document.key,
        docTitle: document.title,
        from,
        to,
        text: lines.join("\n"),
      };
    }),
});
