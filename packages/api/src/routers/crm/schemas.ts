// Zod input schemas for the CRM domain (sprint-3-domain-model.md).
// Unit-tested per PROJECT_RULES.md testing strategy.
import { z } from "zod";

const name = z.string().trim().min(1).max(200);
const shortText = z.string().trim().min(1).max(200);
const longText = z.string().trim().min(1).max(2000);
const email = z.string().trim().email().max(200);

export const clientCreateSchema = z.object({
  name,
  // taxId is free text by ratified decision 3 (NIT validation deferred).
  taxId: shortText.optional(),
  industry: shortText.optional(),
  address: shortText.optional(),
  city: shortText.optional(),
  phone: shortText.optional(),
  email: email.optional(),
  notes: longText.optional(),
});

export const clientUpdateSchema = z.object({
  id: z.string().min(1),
  name: name.optional(),
  taxId: shortText.nullable().optional(),
  industry: shortText.nullable().optional(),
  address: shortText.nullable().optional(),
  city: shortText.nullable().optional(),
  phone: shortText.nullable().optional(),
  email: email.nullable().optional(),
  notes: longText.nullable().optional(),
});

// Default is active-only so pickers (e.g. the project form) stay clean;
// archived history is opt-in (ratified decision 1).
export const clientListSchema = z
  .object({ includeArchived: z.boolean().optional() })
  .optional();

export const clientIdSchema = z.object({ id: z.string().min(1) });

export const contactCreateSchema = z.object({
  clientId: z.string().min(1),
  name,
  title: shortText.optional(),
  email: email.optional(),
  phone: shortText.optional(),
  notes: longText.optional(),
});

export const contactUpdateSchema = z.object({
  id: z.string().min(1),
  name: name.optional(),
  title: shortText.nullable().optional(),
  email: email.nullable().optional(),
  phone: shortText.nullable().optional(),
  notes: longText.nullable().optional(),
});

export const contactIdSchema = z.object({ id: z.string().min(1) });
