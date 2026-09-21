import argon2 from "argon2";
import { canonicalizeShiftedPin } from "../shared/canonicalize.js";
import type { CandidatePattern, VerifyPatternResult } from "../shared/types.js";
import type { SpacebarSecretRepository } from "./SpacebarSecretRepository.js";

export async function verifyPattern(
  userId: string,
  candidate: CandidatePattern,
  repository: SpacebarSecretRepository,
): Promise<VerifyPatternResult> {
  try {
    const stored = await repository.findByUserId(userId);
    if (!stored || stored.schemeVersion !== "SB2") {
      return { success: false, reason: "NO_SECRET" };
    }

    const canonicalCandidate = canonicalizeShiftedPin(candidate.tapCounts);
    const verified = await argon2.verify(stored.argon2idPhc, canonicalCandidate);
    return verified ? { success: true, userId } : { success: false, reason: "VERIFICATION_FAILED" };
  } catch {
    return { success: false, reason: "INVALID_PATTERN" };
  }
}