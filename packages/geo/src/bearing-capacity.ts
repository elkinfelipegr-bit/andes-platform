// Shallow-foundation bearing capacity — general bearing capacity equation
// with Vesic factors and De Beer shape factors (Terzaghi/Meyerhof/Vesic
// lineage; see any foundations text, e.g. Das). Pure function: no I/O, no
// state; the known-answer tests in bearing-capacity.test.ts — checked
// against published factor tables — are this function's contract
// (sprint-7-domain-model.md: the platform computes; the engineer reviews,
// decides, and signs).
//
// Assumptions (documented, enforced, and printed on the memoria):
// - Water table below the influence zone (no correction in this version —
//   ratified decision 4; the memoria states it).
// - Homogeneous soil to the influence depth; vertical, centric load.
// - Shapes: STRIP (B/L → 0, all shape factors 1) and SQUARE (B/L = 1,
//   De Beer: sc = 1 + Nq/Nc, sq = 1 + tanφ, sγ = 0.6).
// - q_adm = q_ult / FS (gross bearing capacity over a global factor).
//
// Units: m, kN/m³, kPa, degrees.

export type FootingShape = "STRIP" | "SQUARE";

export interface BearingCapacityInput {
  /** Footing width B, m */
  b: number;
  /** Foundation depth Df, m (0 = surface footing) */
  df: number;
  /** Soil unit weight γ, kN/m³ */
  gamma: number;
  /** Cohesion c, kPa */
  c: number;
  /** Friction angle φ, degrees */
  phi: number;
  /** Global safety factor FS */
  fs: number;
  shape: FootingShape;
}

export interface BearingCapacityResult {
  /** Vesic bearing capacity factors */
  nc: number;
  nq: number;
  ngamma: number;
  /** Ultimate bearing capacity q_ult, kPa */
  qUlt: number;
  /** Allowable bearing capacity q_adm = q_ult / FS, kPa */
  qAdm: number;
}

export class BearingCapacityInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BearingCapacityInputError";
  }
}

function assertInput(input: BearingCapacityInput): void {
  const { b, df, gamma, c, phi, fs } = input;
  if (!(b > 0) || b > 100) {
    throw new BearingCapacityInputError("B must be positive (≤ 100 m).");
  }
  if (!(df >= 0) || df > 100) {
    throw new BearingCapacityInputError("Df must be ≥ 0 (≤ 100 m).");
  }
  if (!(gamma >= 5 && gamma <= 30)) {
    throw new BearingCapacityInputError("γ must be between 5 and 30 kN/m³.");
  }
  if (!(c >= 0) || c > 1000) {
    throw new BearingCapacityInputError("c must be ≥ 0 (≤ 1000 kPa).");
  }
  if (!(phi >= 0 && phi <= 50)) {
    throw new BearingCapacityInputError("φ must be between 0 and 50 degrees.");
  }
  if (!(fs >= 1 && fs <= 10)) {
    throw new BearingCapacityInputError("FS must be between 1 and 10.");
  }
}

/** Vesic bearing capacity factors. Exported for direct unit testing
 *  against published tables. */
export function bearingFactors(phi: number): {
  nc: number;
  nq: number;
  ngamma: number;
} {
  if (phi === 0) {
    // Undrained (φ = 0) closed form: Nc = π + 2.
    return { nc: 5.14, nq: 1, ngamma: 0 };
  }
  const rad = (phi * Math.PI) / 180;
  const tanPhi = Math.tan(rad);
  const nq = Math.exp(Math.PI * tanPhi) * Math.tan(Math.PI / 4 + rad / 2) ** 2;
  const nc = (nq - 1) / tanPhi;
  const ngamma = 2 * (nq + 1) * tanPhi;
  return { nc, nq, ngamma };
}

export function bearingCapacity(
  input: BearingCapacityInput,
): BearingCapacityResult {
  assertInput(input);
  const { b, df, gamma, c, phi, fs, shape } = input;

  const { nc, nq, ngamma } = bearingFactors(phi);

  // De Beer shape factors; STRIP is the reference case (all 1).
  const tanPhi = Math.tan((phi * Math.PI) / 180);
  const sc = shape === "SQUARE" ? 1 + nq / nc : 1;
  const sq = shape === "SQUARE" ? 1 + tanPhi : 1;
  const sgamma = shape === "SQUARE" ? 0.6 : 1;

  const surcharge = gamma * df; // q̄, kPa

  const qUlt =
    c * nc * sc + surcharge * nq * sq + 0.5 * gamma * b * ngamma * sgamma;

  return { nc, nq, ngamma, qUlt, qAdm: qUlt / fs };
}
