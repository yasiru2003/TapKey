import argon2 from "argon2";
import {
  canonicalizeCountPattern,
  canonicalizeRhythmPattern,
  canonicalizeShiftedPin,
} from "../shared/canonicalize.js";
import type {
  CandidatePattern,
  VerifyPatternResult,
} from "../shared/types.js";
import type { SpacebarSecretRepository } from "./SpacebarSecretRepository.js";

export async function verifyPattern(
  userId: string,
  candidate: CandidatePattern,
  repository: SpacebarSecretRepository,
): Promise<VerifyPatternResult> {
  try {
    const stored = await repository.findByUserId(userId);
    if (!stored) {
      return { success: false, reason: "NO_SECRET" };
    }

    let canonicalCandidate: string;

    if (stored.schemeVersion === "SB2" || ("tapCounts" in candidate)) {
      if (!("tapCounts" in candidate)) {
        return { success: false, reason: "INVALID_PATTERN" };
      }
      canonicalCandidate = canonicalizeShiftedPin(candidate.tapCounts);
    } else if (stored.schemeVersion === "SB1") {
      if ("mode" in candidate && candidate.mode === "COUNT" && stored.mode === "COUNT") {
        canonicalCandidate = canonicalizeCountPattern(candidate.groups);
      } else if (
        "mode" in candidate &&
        candidate.mode === "RHYTHM" &&
        stored.mode === "RHYTHM" &&
        stored.thresholdMs !== undefined &&
        stored.toleranceMs !== undefined
      ) {
        canonicalCandidate = canonicalizeRhythmPattern(
          candidate.timestamps,
          stored.thresholdMs,
          stored.toleranceMs,
        );
      } else {
        return { success: false, reason: "INVALID_PATTERN" };
      }
    } else {
      return { success: false, reason: "NO_SECRET" };
    }

    const verified = await argon2.verify(stored.argon2idPhc, canonicalCandidate);
    return verified
      ? { success: true, userId }
      : { success: false, reason: "VERIFICATION_FAILED" };
  } catch {
    return { success: false, reason: "INVALID_PATTERN" };
  }
}