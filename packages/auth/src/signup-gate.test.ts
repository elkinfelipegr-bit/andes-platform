// Access-control logic — strict tier (PROJECT_RULES.md): every way a
// sign-up could slip through closed registration (ADR-013).
import { describe, expect, it } from "vitest";

import { decideSignUp, parseAllowlist } from "./signup-gate.js";

const now = new Date("2026-11-15T12:00:00Z");
const TOKEN = "tok_abcdefghijklmnop123";
const pending = {
  email: "ana@firma.co",
  status: "PENDING",
  expiresAt: new Date("2026-11-20T00:00:00Z"),
};
const gate = (over: object = {}) =>
  decideSignUp({
    email: "ana@firma.co",
    inviteToken: TOKEN,
    allowlist: undefined,
    findInvitation: async (t) => (t === TOKEN ? pending : null),
    now,
    ...over,
  });

describe("decideSignUp", () => {
  it("allows the invited email with its pending invitation, case-insensitively", async () => {
    expect(await gate()).toEqual({ allowed: true, via: "invitation" });
    expect(await gate({ email: "  ANA@Firma.CO " })).toMatchObject({
      allowed: true,
    });
  });

  it("refuses with no token, a malformed token or an unknown token", async () => {
    for (const inviteToken of [
      null,
      "",
      "short",
      "has spaces in it 123456",
      "x".repeat(20),
    ]) {
      expect((await gate({ inviteToken })).allowed).toBe(false);
    }
  });

  it("never looks anything up for a malformed token", async () => {
    let calls = 0;
    await gate({
      inviteToken: "'; drop table",
      findInvitation: async () => {
        calls += 1;
        return pending;
      },
    });
    expect(calls).toBe(0);
  });

  it("refuses a different email than the invited one", async () => {
    const r = await gate({ email: "otro@firma.co" });
    expect(r).toMatchObject({ allowed: false });
    expect(r.allowed === false && r.reason).toContain("otro correo");
  });

  it("refuses expired, accepted and revoked invitations", async () => {
    const withInvitation = (inv: object) =>
      gate({ findInvitation: async () => ({ ...pending, ...inv }) });
    expect((await withInvitation({ expiresAt: now })).allowed).toBe(false);
    expect(
      (await withInvitation({ expiresAt: new Date("2026-01-01") })).allowed,
    ).toBe(false);
    for (const status of ["ACCEPTED", "REVOKED", "EXPIRED"]) {
      expect((await withInvitation({ status })).allowed).toBe(false);
    }
  });

  it("allows an allowlisted email without any invitation, and only that email", async () => {
    const allowlist = " Admin@Firma.co , otra@firma.co";
    expect(
      await gate({ email: "admin@firma.co", inviteToken: null, allowlist }),
    ).toEqual({ allowed: true, via: "allowlist" });
    expect(
      (
        await gate({
          email: "admin@firma.co.evil.com",
          inviteToken: null,
          allowlist,
        })
      ).allowed,
    ).toBe(false);
    expect(
      (await gate({ email: "", inviteToken: null, allowlist: "," })).allowed,
    ).toBe(false);
  });

  it("parses the allowlist defensively", () => {
    expect(parseAllowlist(undefined)).toEqual([]);
    expect(parseAllowlist(" A@b.co,, c@d.co ")).toEqual(["a@b.co", "c@d.co"]);
  });
});
