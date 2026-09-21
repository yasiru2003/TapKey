export { captureTapPattern } from "./client/captureTapPattern.js";
export type {
  CaptureCallbacks,
  CaptureOptions,
  TapPatternCapture,
} from "./client/captureTapPattern.js";
<<<<<<< HEAD
export { canonicalizeShiftedPin } from "./shared/canonicalize.js";
export type {
  CandidatePattern,
  ShiftedPinPattern,
=======
export { canonicalizeCountPattern, canonicalizeRhythmPattern } from "./shared/canonicalize.js";
export type {
  CandidatePattern,
  CountPattern,
  RhythmPattern,
  SpacebarMode,
>>>>>>> 5382501e8c22ef80dc1321e6f6ccce8ea6408a50
  StoredSpacebarSecret,
  VerifyPatternResult,
} from "./shared/types.js";
export { hashPattern } from "./server/patternHasher.js";
export { verifyPattern } from "./server/patternVerifier.js";
<<<<<<< HEAD
export type { SpacebarSecretRepository } from "./server/SpacebarSecretRepository.js";
export { InMemorySpacebarSecretRepository } from "./server/SpacebarSecretRepository.js";
=======
export type { SpacebarSecretRepository } from "./server/SpacebarSecretRepository.js";
>>>>>>> 5382501e8c22ef80dc1321e6f6ccce8ea6408a50
