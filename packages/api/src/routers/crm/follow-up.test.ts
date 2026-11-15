import { describe, expect, it } from "vitest";

import { dayToDate, daysBetween, followUpState, toDay } from "./follow-up.js";

const open = (day: string | null) => ({
  isOpen: true,
  nextActionAt: day ? dayToDate(day) : null,
});

describe("followUpState", () => {
  const today = "2026-11-13";

  it("classifies a dated next step relative to today", () => {
    expect(followUpState(open("2026-11-12"), today)).toBe("OVERDUE");
    expect(followUpState(open("2026-11-13"), today)).toBe("TODAY");
    expect(followUpState(open("2026-11-14"), today)).toBe("UPCOMING");
    expect(followUpState(open("2026-11-20"), today)).toBe("UPCOMING");
    expect(followUpState(open("2026-11-21"), today)).toBe("LATER");
  });

  it("flags an open opportunity with no next step", () => {
    expect(followUpState(open(null), today)).toBe("NONE");
  });

  it("returns null for closed opportunities, dated or not", () => {
    expect(
      followUpState({ isOpen: false, nextActionAt: null }, today),
    ).toBeNull();
    expect(
      followUpState(
        { isOpen: false, nextActionAt: dayToDate("2026-01-01") },
        today,
      ),
    ).toBeNull();
  });

  it("is stable across month and year boundaries", () => {
    expect(followUpState(open("2026-12-31"), "2027-01-01")).toBe("OVERDUE");
    expect(daysBetween("2026-02-28", "2026-03-01")).toBe(1);
    expect(toDay(dayToDate("2026-11-13"))).toBe("2026-11-13");
  });
});
