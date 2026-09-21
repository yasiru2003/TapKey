import argon2 from "argon2";
<<<<<<< HEAD
import { canonicalizeShiftedPin } from "../shared/canonicalize.js";
import type { CandidatePattern, VerifyPatternResult } from "../shared/types.js";
=======
import { canonicalizeCountPattern, canonicalizeRhythmPattern } from "../shared/canonicalize.js";
import type {
  CandidatePattern,
  VerifyPatternResult,
} from "../shared/types.js";
>>>>>>> 5382501e8c22ef80dc1321e6f6ccce8ea6408a50
import type { SpacebarSecretRepository } from "./SpacebarSecretRepository.js";

export async function verifyPattern(
  userId: string,
  candidate: CandidatePattern,
  repository: SpacebarSecretRepository,
): Promise<VerifyPatternResult> {
  try {
    const stored = await repository.findByUserId(userId);
<<<<<<< HEAD
    if (!stored || stored.schemeVersion !== "SB2") {
      return { success: false, reason: "NO_SECRET" };
    }

    const canonicalCandidate = canonicalizeShiftedPin(candidate.tapCounts);
    const verified = await argon2.verify(stored.argon2idPhc, canonicalCandidate);
    return verified ? { success: true, userId } : { success: false, reason: "VERIFICATION_FAILED" };
=======
    if (!stored || stored.schemeVersion !== "SB1") {
      return { success: false, reason: "NO_SECRET" };
    }

    let canonicalCandidate: string;
    if (stored.mode === "COUNT" && candidate.mode === "COUNT") {
      canonicalCandidate = canonicalizeCountPattern(candidate.groups);
    } else if (
      stored.mode === "RHYTHM" &&
      candidate.mode === "RHYTHM" &&
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

    const verified = await argon2.verify(stored.argon2idPhc, canonicalCandidate);
    return verified
      ? { success: true, userId }
      : { success: false, reason: "VERIFICATION_FAILED" };
>>>>>>> 5382501e8c22ef80dc1321e6f6ccce8ea6408a50
  } catch {
    return { success: false, reason: "INVALID_PATTERN" };
  }
}