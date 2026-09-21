export { captureTapPattern } from "./client/captureTapPattern.js";
export type {
  CaptureCallbacks,
  CaptureOptions,
  TapPatternCapture,
} from "./client/captureTapPattern.js";
export { canonicalizeShiftedPin } from "./shared/canonicalize.js";
export type {
  CandidatePattern,
  ShiftedPinPattern,
  StoredSpacebarSecret,
  VerifyPatternResult,
} from "./shared/types.js";
export { hashPattern } from "./server/patternHasher.js";
export { verifyPattern } from "./server/patternVerifier.js";
export type { SpacebarSecretRepository } from "./server/SpacebarSecretRepository.js";
export { InMemorySpacebarSecretRepository } from "./server/SpacebarSecretRepository.js";