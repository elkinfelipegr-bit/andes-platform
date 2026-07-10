// @andes/structures — deterministic structural design checks
// (sprint-6-domain-model.md). Pure functions; the known-answer tests are
// the contract. The API layer is the only caller — the UI never computes.
export {
  beamFlexure,
  beta1,
  BeamFlexureInputError,
  type BeamFlexureInput,
  type BeamFlexureResult,
  type BeamFlexureVerdict,
} from "./beam-flexure.js";
