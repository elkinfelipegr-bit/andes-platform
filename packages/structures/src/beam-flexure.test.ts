// Known-answer tests — hand-worked from the NSR-10 C.10 equations. These
// are beamFlexure()'s contract: any change that moves these numbers is a
// domain decision, not a refactor (sprint-6-domain-model.md, ratified
// decision 4: evidence must never be silently rewritten).
import { describe, expect, it } from "vitest";

import { beamFlexure, BeamFlexureInputError, beta1 } from "./beam-flexure.js";

// Reference section: b=300, h=500, cover=60 → d=440; f'c=21, fy=420.
const section = { b: 300, h: 500, cover: 60, fc: 21, fy: 420 };

describe("beta1 (NSR-10 C.10.2.7.3)", () => {
  it("is 0.85 up to f'c = 28 MPa", () => {
    expect(beta1(21)).toBe(0.85);
    expect(beta1(28)).toBe(0.85);
  });
  it("reduces 0.05 per 7 MPa above 28", () => {
    expect(beta1(35)).toBeCloseTo(0.8, 10);
    expect(beta1(42)).toBeCloseTo(0.75, 10);
  });
  it("never drops below 0.65", () => {
    expect(beta1(70)).toBeCloseTo(0.65, 10);
    expect(beta1(100)).toBe(0.65);
  });
});

describe("beamFlexure — hand-worked known answers", () => {
  it("normal case: Mu=120 kN·m → ρ≈0.005872, As≈775 mm², OK", () => {
    // Rn = 120e6 / (0.9·300·440²) = 2.295684 MPa
    // ρ  = (0.85·21/420)(1 − √(1 − 2·2.295684/(0.85·21))) = 0.0058715
    // As = ρ·300·440 = 775.0 mm²
    const r = beamFlexure({ ...section, mu: 120 });
    expect(r.d).toBe(440);
    expect(r.rhoRequired).toBeCloseTo(0.0058715, 6);
    expect(r.requiredAs).toBeCloseTo(775.0, 0);
    expect(r.rhoMin).toBeCloseTo(1.4 / 420, 8); // 1.4/fy governs at f'c=21
    expect(r.rhoMax).toBeCloseTo(0.31875 * 0.85 * (21 / 420), 8); // 0.0135469
    expect(r.verdict).toBe("OK");
  });

  it("light moment: Mu=30 kN·m → ρ<ρmin, minimum steel governs (As=ρmin·b·d=440 mm²)", () => {
    // Rn = 0.573921 MPa → ρ = 0.0013892 < ρmin = 0.0033333
    const r = beamFlexure({ ...section, mu: 30 });
    expect(r.rhoRequired).toBeCloseTo(0.0013892, 6);
    expect(r.verdict).toBe("USE_MIN");
    expect(r.requiredAs).toBeCloseTo((1.4 / 420) * 300 * 440, 1); // 440.0
  });

  it("infeasible demand: Mu=600 kN·m → negative discriminant → INCREASE_SECTION, no ρ", () => {
    // Rn = 11.478 MPa; 2Rn/(0.85·f'c) = 1.286 > 1
    const r = beamFlexure({ ...section, mu: 600 });
    expect(r.verdict).toBe("INCREASE_SECTION");
    expect(r.rhoRequired).toBeNull();
    expect(r.requiredAs).toBeNull();
  });

  it("over-reinforced: Mu=400 kN·m → ρ≈0.026451 > ρmax → INCREASE_SECTION, ρ reported as evidence", () => {
    // Rn = 7.652281 MPa → ρ = 0.0264509 > ρmax = 0.0135469
    const r = beamFlexure({ ...section, mu: 400 });
    expect(r.verdict).toBe("INCREASE_SECTION");
    expect(r.rhoRequired).toBeCloseTo(0.0264509, 6);
    expect(r.requiredAs).toBeNull();
  });

  it("f'c above 28 exercises the β1 reduction and the √f'c ρmin branch", () => {
    // f'c=35 → β1=0.80 → ρmax = 0.31875·0.80·35/420 = 0.02125
    // ρmin = 0.25·√35/420 = 0.0035215 (> 1.4/420)
    const r = beamFlexure({ ...section, fc: 35, mu: 120 });
    expect(r.rhoMax).toBeCloseTo(0.02125, 8);
    expect(r.rhoMin).toBeCloseTo((0.25 * Math.sqrt(35)) / 420, 8);
    expect(r.verdict).toBe("OK");
  });

  it("boundary sanity: a check exactly at As just above minimum stays OK", () => {
    // Mu=72 kN·m → ρ = 0.0034397 ≥ ρmin = 0.0033333 → OK (not USE_MIN)
    const r = beamFlexure({ ...section, mu: 72 });
    expect(r.rhoRequired).toBeGreaterThan(r.rhoMin);
    expect(r.verdict).toBe("OK");
  });
});

describe("beamFlexure — input validation", () => {
  it("rejects non-positive dimensions and moment", () => {
    expect(() => beamFlexure({ ...section, mu: 0 })).toThrow(
      BeamFlexureInputError,
    );
    expect(() => beamFlexure({ ...section, b: -300, mu: 100 })).toThrow(
      BeamFlexureInputError,
    );
  });
  it("rejects cover ≥ h", () => {
    expect(() => beamFlexure({ ...section, cover: 500, mu: 100 })).toThrow(
      BeamFlexureInputError,
    );
  });
  it("rejects out-of-range materials", () => {
    expect(() => beamFlexure({ ...section, fc: 10, mu: 100 })).toThrow(
      BeamFlexureInputError,
    );
    expect(() => beamFlexure({ ...section, fy: 800, mu: 100 })).toThrow(
      BeamFlexureInputError,
    );
  });
});
