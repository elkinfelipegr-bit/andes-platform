import { describe, expect, it } from "vitest";

import {
  isValidCronSecret,
  renderDigest,
  type MemberDigest,
} from "./digest.js";

const digest: MemberDigest = {
  userId: "u1",
  name: "Ana <b>",
  email: "ana@example.com",
  due: [
    {
      opportunityId: "o1",
      title: "Bodega",
      client: "Acme & Co",
      nextAction: 'Llamar "hoy"',
      daysLate: 2,
    },
    {
      opportunityId: "o2",
      title: "Casa",
      client: "Beta",
      nextAction: null,
      daysLate: 0,
    },
  ],
  unplanned: [{ opportunityId: "o3", title: "Lote", client: "Gamma" }],
  quotes: [
    {
      proposalId: "p1",
      code: "COT-1",
      title: "Diseño",
      client: "Acme & Co",
      daysWaiting: 5,
    },
    {
      proposalId: "p2",
      code: "COT-2",
      title: "Viejo",
      client: "Beta",
      daysWaiting: null,
    },
  ],
};

describe("renderDigest", () => {
  const r = renderDigest(digest, "https://app.example.com/");

  it("puts the count in the subject and links every row to the app", () => {
    expect(r.subject).toBe("2 follow-ups due today");
    expect(r.text).toContain("https://app.example.com/crm/pipeline/o1");
    expect(r.text).toContain("https://app.example.com/crm/proposals/p1");
    expect(r.text).not.toContain(".com//crm");
    expect(r.text).toContain("(2 days late)");
    expect(r.text).toContain("Follow up — Beta · Casa (today)");
    expect(r.text).toContain("(sent 5 d ago)");
    expect(r.text).toContain("COT-2 Viejo — Beta\n");
  });

  it("escapes user-entered text in the HTML body", () => {
    expect(r.html).toContain("Ana &lt;b&gt;");
    expect(r.html).toContain("Acme &amp; Co");
    expect(r.html).toContain("Llamar &quot;hoy&quot;");
    expect(r.html).not.toContain("<b>");
  });

  it("uses a different subject when nothing is due", () => {
    const quiet = renderDigest({ ...digest, due: [], quotes: [] }, "https://x");
    expect(quiet.subject).toBe("Your pipeline needs a next step");
    expect(quiet.text).not.toContain("Due:");
  });
});

describe("isValidCronSecret", () => {
  const secret = "s".repeat(32);
  it("accepts only the exact bearer secret and is closed when unset", () => {
    expect(isValidCronSecret(`Bearer ${secret}`, secret)).toBe(true);
    expect(isValidCronSecret(`Bearer ${secret}x`, secret)).toBe(false);
    expect(isValidCronSecret(null, secret)).toBe(false);
    expect(isValidCronSecret("Bearer undefined", undefined)).toBe(false);
    expect(isValidCronSecret("Bearer short", "short")).toBe(false);
  });
});
