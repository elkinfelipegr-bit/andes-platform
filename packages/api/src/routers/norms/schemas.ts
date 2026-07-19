// Zod input schemas for the Norms Reference module (sprint-11.md).
import { z } from "zod";

export const normsSearchSchema = z.object({
  query: z.string().trim().min(2).max(200),
  docKey: z.string().trim().min(1).max(32).optional(),
  limit: z.number().int().min(1).max(20).default(8),
});

// One exact passage — the docs_Tec "--ver" equivalent. Span capped so a
// client can never pull a whole copyrighted document through this.
export const normsRangeSchema = z
  .object({
    docKey: z.string().trim().min(1).max(32),
    from: z.number().int().min(1),
    to: z.number().int().min(1),
  })
  .refine((r) => r.to >= r.from && r.to - r.from <= 200, {
    message: "Range must be ascending and at most 200 lines.",
  });
