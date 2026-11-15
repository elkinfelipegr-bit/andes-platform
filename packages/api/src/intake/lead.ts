// Inbound lead intake (ADR-011): the public website hands a contact
// request to the platform, which records it as a Client + Opportunity +
// first Activity in ONE configured tenant. This is not a tRPC procedure —
// there is no user session — so it takes the tenant id from server
// configuration and does every read and write through forTenant: both
// RFC-001 layers apply exactly as they do for a signed-in member.
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { forTenant, type PrismaClient } from "@andes/db";

const text = (max: number) => z.string().trim().min(1).max(max);

export const leadIntakeSchema = z.object({
  // The person who wrote. Used as the client name when no company is given.
  name: text(120),
  company: text(200).optional(),
  email: z.string().trim().toLowerCase().email().max(200).optional(),
  phone: text(60).optional(),
  // What they need, in one line — becomes the opportunity title.
  subject: text(200),
  // The full request as the website composed it — becomes the first note.
  message: text(4000),
  // Where on the website it came from (e.g. "Website · Lot planner").
  source: text(200).optional(),
});

export type LeadIntakeInput = z.infer<typeof leadIntakeSchema>;

// Constant-time comparison of the presented bearer key. Returns false for
// a missing header, a non-Bearer scheme, or an unset/short expected key —
// an unconfigured endpoint must never be open.
export function isValidIntakeKey(
  authorization: string | null,
  expected: string | undefined,
): boolean {
  if (!expected || expected.length < 24 || !authorization) return false;
  const match = /^Bearer (.+)$/.exec(authorization);
  if (!match) return false;
  const a = Buffer.from(match[1]!);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export class LeadIntakeError extends Error {}

export async function intakeLead(
  db: PrismaClient,
  tenantId: string,
  input: LeadIntakeInput,
) {
  const tenantDb = forTenant(db, tenantId);

  // An opportunity needs an owner who is a member. Leads land on the
  // firm's first OWNER_ADMIN; anyone can reassign from the pipeline.
  const owner =
    (await tenantDb.membership.findFirst({
      where: { tenantId, role: { key: "OWNER_ADMIN" } },
      orderBy: { createdAt: "asc" },
      select: { userId: true },
    })) ??
    (await tenantDb.membership.findFirst({
      where: { tenantId },
      orderBy: { createdAt: "asc" },
      select: { userId: true },
    }));
  if (!owner) {
    throw new LeadIntakeError("The intake tenant has no members.");
  }

  // Same email as an existing active client of THIS tenant → same client:
  // a returning prospect must not become a duplicate record.
  const existing = input.email
    ? await tenantDb.client.findFirst({
        where: {
          tenantId,
          archivedAt: null,
          email: { equals: input.email, mode: "insensitive" },
        },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      })
    : null;
  const client =
    existing ??
    (await tenantDb.client.create({
      data: {
        tenantId,
        name: input.company ?? input.name,
        email: input.email,
        phone: input.phone,
        notes: `Created from a website request by ${input.name}.`,
      },
      select: { id: true },
    }));

  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const opportunity = await tenantDb.opportunity.create({
    data: {
      tenantId,
      clientId: client.id,
      title: input.subject,
      source: input.source ?? "Website",
      ownerId: owner.userId,
      createdById: owner.userId,
      // A lead nobody answers is the failure this exists to prevent: it
      // enters the agenda as due today.
      nextAction: "Reply to the website request",
      nextActionAt: today,
      activities: {
        create: [
          {
            tenantId,
            type: "NOTE",
            body: [
              `Website request from ${input.name}`,
              input.email ? `Email: ${input.email}` : null,
              input.phone ? `Phone: ${input.phone}` : null,
              "",
              input.message,
            ]
              .filter((line) => line !== null)
              .join("\n")
              .slice(0, 4000),
            createdById: owner.userId,
          },
        ],
      },
    },
    select: { id: true },
  });

  return { opportunityId: opportunity.id, clientId: client.id };
}
