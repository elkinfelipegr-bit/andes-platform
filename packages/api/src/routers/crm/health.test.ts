import { describe, expect, it } from "vitest";

import {
  daysSince,
  effectiveProbability,
  opportunityRisks,
  weightedValue,
  type HealthInput,
} from "./health.js";

const now = new Date("2026-11-20T15:00:00Z");
const ago = (days: number) => new Date(now.getTime() - days * 86_400_000);
const base: HealthInput = {
  stage: "CONTACTED",
  followUp: "UPCOMING",
  createdAt: ago(3),
  lastActivityAt: ago(1),
  humanActivities: 2,
  oldestSentAt: null,
};

describe("forecast", () => {
  it("uses the stage default unless overridden, and never overrides a closed stage", () => {
    expect(effectiveProbability("LEAD", null)).toBe(10);
    expect(effectiveProbability("QUOTED", null)).toBe(50);
    expect(effectiveProbability("QUOTED", 80)).toBe(80);
    expect(effectiveProbability("QUOTED", 0)).toBe(0);
    expect(effectiveProbability("WON", 20)).toBe(100);
    expect(effectiveProbability("LOST", 90)).toBe(0);
  });

  it("weights the value and leaves an unknown value unknown", () => {
    expect(weightedValue(10_000_000, "QUOTED", null)).toBe(5_000_000);
    expect(weightedValue(10_000_000, "NEGOTIATION", 90)).toBe(9_000_000);
    expect(weightedValue(null, "QUOTED", null)).toBeNull();
  });
});

describe("opportunityRisks", () => {
  it("reports nothing for a healthy open opportunity or a closed one", () => {
    expect(opportunityRisks(base, now)).toEqual([]);
    expect(
      opportunityRisks(
        { ...base, stage: "LOST", followUp: null, lastActivityAt: ago(90) },
        now,
      ),
    ).toEqual([]);
  });

  it("flags an overdue next step and a missing one", () => {
    expect(opportunityRisks({ ...base, followUp: "OVERDUE" }, now)).toEqual([
      "OVERDUE",
    ]);
    expect(opportunityRisks({ ...base, followUp: "NONE" }, now)).toEqual([
      "NO_NEXT_STEP",
    ]);
  });

  it("flags a quote waiting 7 days or more, not 6", () => {
    expect(
      opportunityRisks({ ...base, stage: "QUOTED", oldestSentAt: ago(6) }, now),
    ).toEqual([]);
    expect(
      opportunityRisks({ ...base, stage: "QUOTED", oldestSentAt: ago(7) }, now),
    ).toEqual(["QUOTE_WAITING"]);
  });

  it("goes cold after 14 quiet days, counted from creation when never touched", () => {
    expect(opportunityRisks({ ...base, lastActivityAt: ago(13) }, now)).toEqual(
      [],
    );
    expect(opportunityRisks({ ...base, lastActivityAt: ago(14) }, now)).toEqual(
      ["COLD"],
    );
    expect(
      opportunityRisks(
        { ...base, lastActivityAt: null, createdAt: ago(20) },
        now,
      ),
    ).toEqual(["COLD"]);
  });

  it("flags a request nobody answered after a day, only while it is a new lead", () => {
    const request: HealthInput = {
      ...base,
      stage: "LEAD",
      humanActivities: 0,
      createdAt: ago(1),
      lastActivityAt: ago(1),
    };
    expect(opportunityRisks(request, now)).toEqual(["UNANSWERED_REQUEST"]);
    expect(opportunityRisks({ ...request, createdAt: ago(0) }, now)).toEqual(
      [],
    );
    expect(opportunityRisks({ ...request, humanActivities: 1 }, now)).toEqual(
      [],
    );
    expect(opportunityRisks({ ...request, stage: "CONTACTED" }, now)).toEqual(
      [],
    );
  });

  it("orders several risks by urgency", () => {
    expect(
      opportunityRisks(
        {
          ...base,
          stage: "QUOTED",
          followUp: "OVERDUE",
          oldestSentAt: ago(30),
          lastActivityAt: ago(30),
        },
        now,
      ),
    ).toEqual(["OVERDUE", "QUOTE_WAITING", "COLD"]);
  });

  it("daysSince floors and never goes negative", () => {
    expect(daysSince(ago(2.9), now)).toBe(2);
    expect(daysSince(new Date(now.getTime() + 5000), now)).toBe(0);
    expect(daysSince(null, now)).toBeNull();
  });
});
