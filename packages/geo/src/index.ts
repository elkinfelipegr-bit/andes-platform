// @andes/geo — deterministic geotechnical checks
// (sprint-7-domain-model.md). Pure functions; the known-answer tests are
// the contract. The API layer is the only caller — the UI never computes.
export {
  bearingCapacity,
  bearingFactors,
  BearingCapacityInputError,
  type BearingCapacityInput,
  type BearingCapacityResult,
  type FootingShape,
} from "./bearing-capacity.js";
