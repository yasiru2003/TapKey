export { captureTapPattern } from "./client/captureTapPattern.js";
export type {
  CaptureCallbacks,
  CaptureOptions,
  TapPatternCapture,
} from "./client/captureTapPattern.js";
export { canonicalizeCountPattern, canonicalizeRhythmPattern } from "./shared/canonicalize.js";
export type {
  CandidatePattern,
  CountPattern,
  RhythmPattern,
  SpacebarMode,
  StoredSpacebarSecret,
  VerifyPatternResult,
} from "./shared/types.js";
export { hashPattern } from "./server/patternHasher.js";
export { verifyPattern } from "./server/patternVerifier.js";
export type { SpacebarSecretRepository } from "./server/SpacebarSecretRepository.js";