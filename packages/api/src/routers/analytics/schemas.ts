// Zod input schemas for Analytics (sprint-14-domain-model.md). A period
// is a closed range of UTC calendar days (ratification question 5).
import { z } from "zod";

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Se esperaba una fecha con formato AAAA-MM-DD")
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), "Fecha inválida");

// Five years of months is plenty for a chart and bounds the read.
export const MAX_PERIOD_DAYS = 366 * 5;

export const periodSchema = z
  .object({
    from: day,
    to: day,
    clientId: z.string().min(1).optional(),
  })
  .refine((p) => p.from <= p.to, {
    message: "El periodo debe empezar antes de terminar.",
    path: ["to"],
  })
  .refine(
    (p) =>
      (Date.parse(`${p.to}T00:00:00Z`) - Date.parse(`${p.from}T00:00:00Z`)) /
        86_400_000 <=
      MAX_PERIOD_DAYS,
    { message: "El periodo no puede superar cinco años.", path: ["to"] },
  );

export type Period = z.infer<typeof periodSchema>;
