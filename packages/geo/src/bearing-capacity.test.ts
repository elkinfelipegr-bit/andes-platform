// Known-answer tests — factor values checked against published Vesic
// tables (any foundations text, e.g. Das) and hand-worked capacity cases.
// These are bearingCapacity()'s contract: any change that moves these
// numbers is a domain decision, not a refactor (the Sprint 6 evidence
// rule, sprint-7-domain-model.md).
import { describe, expect, it } from "vitest";

import {
  bearingCapacity,
  BearingCapacityInputError,
  bearingFactors,
} from "./bearing-capacity.js";

describe("bearingFactors (Vesic) — published table values", () => {
  it("φ=0 (undrained): Nc=5.14, Nq=1, Nγ=0", () => {
    const f = bearingFactors(0);
    expect(f.nc).toBe(5.14);
    expect(f.nq).toBe(1);
    expect(f.ngamma).toBe(0);
  });

  it("φ=30°: Nq≈18.40, Nc≈30.14, Nγ≈22.40", () => {
    // Nq = e^(π·tan30°)·tan²(60°) = 6.1337·3 = 18.401
    // Nc = (Nq−1)/tan30° = 17.401·1.7321 = 30.140
    // Nγ = 2(Nq+1)·tan30° = 2·19.401·0.57735 = 22.402
    const f = bearingFactors(30);
    expect(f.nq).toBeCloseTo(18.401, 2);
    expect(f.nc).toBeCloseTo(30.14, 2);
    expect(f.ngamma).toBeCloseTo(22.402, 2);
  });

  it("φ=20°: Nq≈6.40, Nc≈14.83, Nγ≈5.39", () => {
    const f = bearingFactors(20);
    expect(f.nq).toBeCloseTo(6.399, 2);
    expect(f.nc).toBeCloseTo(14.835, 2);
    expect(f.ngamma).toBeCloseTo(5.386, 2);
  });
});

describe("bearingCapacity — hand-worked known answers", () => {
  it("strip footing on sand: B=1.5, Df=1.5, γ=18, c=0, φ=30, FS=3 → qUlt≈799.3, qAdm≈266.4 kPa", () => {
    // q̄ = 18·1.5 = 27 kPa
    // qUlt = 0 + 27·18.401 + 0.5·18·1.5·22.402 = 496.83 + 302.43 = 799.26
    const r = bearingCapacity({
      b: 1.5,
      df: 1.5,
      gamma: 18,
      c: 0,
      phi: 30,
      fs: 3,
      shape: "STRIP",
    });
    expect(r.qUlt).toBeCloseTo(799.26, 1);
    expect(r.qAdm).toBeCloseTo(266.42, 1);
  });

  it("square footing on undrained clay: B=2, Df=1, γ=17, c=50, φ=0, FS=3 → qUlt≈324.0 kPa", () => {
    // sc = 1 + Nq/Nc = 1 + 1/5.14 = 1.19455; sq = 1; Nγ term = 0
    // qUlt = 50·5.14·1.19455 + 17·1·1 = 307.00 + 17 = 324.00
    const r = bearingCapacity({
      b: 2,
      df: 1,
      gamma: 17,
      c: 50,
      phi: 0,
      fs: 3,
      shape: "SQUARE",
    });
    expect(r.qUlt).toBeCloseTo(324.0, 1);
    expect(r.qAdm).toBeCloseTo(108.0, 1);
  });

  it("square footing on sand raises the surcharge term (sq=1+tanφ) and reduces the width term (sγ=0.6)", () => {
    // Same sand case as the strip test, SQUARE:
    // qUlt = 27·18.401·1.57735 + 0.5·18·1.5·22.402·0.6 = 783.67 + 181.46 = 965.13
    const r = bearingCapacity({
      b: 1.5,
      df: 1.5,
      gamma: 18,
      c: 0,
      phi: 30,
      fs: 3,
      shape: "SQUARE",
    });
    expect(r.qUlt).toBeCloseTo(965.13, 1);
  });

  it("surface footing (Df=0) drops the surcharge term entirely", () => {
    const r = bearingCapacity({
      b: 1.0,
      df: 0,
      gamma: 18,
      c: 0,
      phi: 30,
      fs: 3,
      shape: "STRIP",
    });
    // qUlt = 0.5·18·1.0·22.402 = 201.62
    expect(r.qUlt).toBeCloseTo(201.62, 1);
  });

  it("FS divides linearly", () => {
    const base = {
      b: 1.5,
      df: 1.5,
      gamma: 18,
      c: 10,
      phi: 25,
      shape: "STRIP" as const,
    };
    const fs2 = bearingCapacity({ ...base, fs: 2 });
    const fs4 = bearingCapacity({ ...base, fs: 4 });
    expect(fs2.qUlt).toBeCloseTo(fs4.qUlt, 8);
    expect(fs2.qAdm).toBeCloseTo(fs4.qAdm * 2, 8);
  });
});

describe("bearingCapacity — input validation", () => {
  const valid = {
    b: 1.5,
    df: 1.5,
    gamma: 18,
    c: 0,
    phi: 30,
    fs: 3,
    shape: "STRIP" as const,
  };

  it("rejects non-positive width and negative depth", () => {
    expect(() => bearingCapacity({ ...valid, b: 0 })).toThrow(
      BearingCapacityInputError,
    );
    expect(() => bearingCapacity({ ...valid, df: -1 })).toThrow(
      BearingCapacityInputError,
    );
  });

  it("rejects out-of-range soil parameters and FS", () => {
    expect(() => bearingCapacity({ ...valid, gamma: 3 })).toThrow(
      BearingCapacityInputError,
    );
    expect(() => bearingCapacity({ ...valid, phi: 55 })).toThrow(
      BearingCapacityInputError,
    );
    expect(() => bearingCapacity({ ...valid, c: -5 })).toThrow(
      BearingCapacityInputError,
    );
    expect(() => bearingCapacity({ ...valid, fs: 0.5 })).toThrow(
      BearingCapacityInputError,
    );
  });
});
