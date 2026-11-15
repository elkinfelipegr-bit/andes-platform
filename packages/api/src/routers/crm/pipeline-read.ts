// The pipeline read (sprint-15/16 domain models): every opportunity of a
// tenant with its follow-up state, forecast and risks. One function so the
// screen, the emailed report and the tests all see the same figures. The
// caller passes a tenant-scoped client; the explicit tenantId filter is
// RFC-001 layer 1 on top of it.
import type { TenantClient } from "@andes/db";

import { followUpState } from "./follow-up.js";
import {
  daysSince,
  effectiveProbability,
  opportunityRisks,
  weightedValue,
} from "./health.js";
import { isOpenStage } from "./opportunity-schemas.js";

const clientSummary = { select: { id: true, name: true } } as const;
const userSummary = { select: { id: true, name: true } } as const;

export async function readPipeline(
  tenantDb: TenantClient,
  tenantId: string,
  today: string,
  now: Date,
) {
  const rows = await tenantDb.opportunity.findMany({
    where: { tenantId: tenantId },
    include: {
      client: clientSummary,
      owner: userSummary,
      activities: {
        orderBy: { occurredAt: "desc" },
        take: 1,
        select: { type: true, occurredAt: true },
      },
      // Oldest quote still awaiting an answer (Sprint 16 aging).
      proposals: {
        where: { status: "SENT" },
        orderBy: { sentAt: "asc" },
        take: 1,
        select: { sentAt: true },
      },
      _count: {
        select: {
          proposals: true,
          // Activities logged by members; the intake REQUEST is not one.
          activities: { where: { type: { not: "REQUEST" } } },
        },
      },
    },
    orderBy: [{ nextActionAt: "asc" }, { updatedAt: "desc" }],
  });
  return rows.map(
    ({ activities, proposals, estimatedValue, probability, ...o }) => {
      const value = estimatedValue === null ? null : estimatedValue.toNumber();
      const lastActivity = activities[0] ?? null;
      const followUp = followUpState(
        { isOpen: isOpenStage(o.stage), nextActionAt: o.nextActionAt },
        today,
      );
      const oldestSentAt = proposals[0]?.sentAt ?? null;
      return {
        ...o,
        estimatedValue: value,
        lastActivity,
        followUp,
        probability: effectiveProbability(o.stage, probability),
        probabilityIsDefault: probability === null,
        weightedValue: weightedValue(value, o.stage, probability),
        daysInStage: daysSince(o.stageChangedAt, now) ?? 0,
        daysSinceActivity:
          daysSince(lastActivity?.occurredAt ?? o.createdAt, now) ?? 0,
        daysQuoteWaiting: daysSince(oldestSentAt, now),
        risks: opportunityRisks(
          {
            stage: o.stage,
            followUp,
            createdAt: o.createdAt,
            lastActivityAt: lastActivity?.occurredAt ?? null,
            humanActivities: o._count.activities,
            oldestSentAt,
          },
          now,
        ),
      };
    },
  );
}

export type PipelineRow = Awaited<ReturnType<typeof readPipeline>>[number];
