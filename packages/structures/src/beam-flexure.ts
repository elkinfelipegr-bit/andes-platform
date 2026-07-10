// RC rectangular beam flexural design — NSR-10 Título C, Capítulo C.10
// (equivalent to ACI 318). Pure function: no I/O, no state; double-precision
// floats are the engineering convention for these closed-form equations.
// The known-answer tests in beam-flexure.test.ts are this function's
// contract (sprint-6-domain-model.md: the platform computes; the engineer
// reviews, decides, and signs).
//
// Assumptions (documented, enforced):
// - Tension reinforcement only, rectangular section.
// - Tension-controlled design: φ = 0.90 (NSR-10 C.9.3.2.1), with ρmax set
//   at εt = 0.005 (C.9.3.3.1 / C.10.3.4) so the φ assumption always holds.
// - ρmin per C.10.5.1: max(0.25·√f'c / fy, 1.4 / fy).
// - β1 per C.10.2.7.3: 0.85 for f'c ≤ 28 MPa, reduced 0.05 per 7 MPa
//   above, not less than 0.65.

export interface BeamFlexureInput {
  /** Section width, mm */
  b: number;
  /** Total section height, mm */
  h: number;
  /** Distance from tension face to steel centroid, mm */
  cover: number;
  /** Concrete compressive strength f'c, MPa */
  fc: number;
  /** Steel yield strength fy, MPa */
  fy: number;
  /** Factored moment Mu, kN·m */
  mu: number;
}

export type BeamFlexureVerdict = "OK" | "USE_MIN" | "INCREASE_SECTION";

export interface BeamFlexureResult {
  /** Effective depth d = h − cover, mm */
  d: number;
  /** Flexural reinforcement ratio required by Mu; null when the section
   *  cannot develop the demanded Rn at all (negative discriminant). */
  rhoRequired: number | null;
  /** Minimum ratio, NSR-10 C.10.5.1 */
  rhoMin: number;
  /** Maximum ratio for tension-controlled behavior (εt = 0.005) */
  rhoMax: number;
  /** Governing steel area, mm² — max(ρ_req, ρmin)·b·d; null when the
   *  verdict is INCREASE_SECTION. */
  requiredAs: number | null;
  verdict: BeamFlexureVerdict;
}

const PHI = 0.9;
const EPSILON_CU = 0.003; // concrete crushing strain
const EPSILON_T_MIN = 0.005; // tension-controlled limit

export class BeamFlexureInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BeamFlexureInputError";
  }
}

function assertInput(input: BeamFlexureInput): void {
  const { b, h, cover, fc, fy, mu } = input;
  if (!(b > 0) || !(h > 0) || !(cover > 0) || !(mu > 0)) {
    throw new BeamFlexureInputError(
      "b, h, cover and Mu must be positive numbers.",
    );
  }
  if (cover >= h) {
    throw new BeamFlexureInputError("cover must be smaller than h.");
  }
  if (!(fc >= 17 && fc <= 100)) {
    throw new BeamFlexureInputError("f'c must be between 17 and 100 MPa.");
  }
  if (!(fy >= 240 && fy <= 700)) {
    throw new BeamFlexureInputError("fy must be between 240 and 700 MPa.");
  }
}

/** β1 per NSR-10 C.10.2.7.3. Exported for direct unit testing. */
export function beta1(fc: number): number {
  if (fc <= 28) return 0.85;
  return Math.max(0.65, 0.85 - (0.05 * (fc - 28)) / 7);
}

export function beamFlexure(input: BeamFlexureInput): BeamFlexureResult {
  assertInput(input);
  const { b, h, cover, fc, fy } = input;

  const d = h - cover;
  const muNmm = input.mu * 1e6; // kN·m → N·mm

  // Required nominal strength coefficient Rn = Mu / (φ·b·d²), MPa.
  const rn = muNmm / (PHI * b * d * d);

  const rhoMin = Math.max((0.25 * Math.sqrt(fc)) / fy, 1.4 / fy);
  const rhoMax =
    0.85 * beta1(fc) * (fc / fy) * (EPSILON_CU / (EPSILON_CU + EPSILON_T_MIN));

  // ρ = (0.85·f'c / fy)·(1 − √(1 − 2·Rn / (0.85·f'c)))
  const discriminant = 1 - (2 * rn) / (0.85 * fc);
  if (discriminant < 0) {
    // The section cannot develop Rn even at the balanced limit.
    return {
      d,
      rhoRequired: null,
      rhoMin,
      rhoMax,
      requiredAs: null,
      verdict: "INCREASE_SECTION",
    };
  }

  const rhoRequired = ((0.85 * fc) / fy) * (1 - Math.sqrt(discriminant));

  if (rhoRequired > rhoMax) {
    // Feasible mathematically but not tension-controlled: reject rather
    // than silently switch to compression steel or φ < 0.90.
    return {
      d,
      rhoRequired,
      rhoMin,
      rhoMax,
      requiredAs: null,
      verdict: "INCREASE_SECTION",
    };
  }

  const governingRho = Math.max(rhoRequired, rhoMin);
  const requiredAs = governingRho * b * d;

  return {
    d,
    rhoRequired,
    rhoMin,
    rhoMax,
    requiredAs,
    verdict: rhoRequired < rhoMin ? "USE_MIN" : "OK",
  };
}
