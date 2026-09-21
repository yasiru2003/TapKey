export interface ShiftedPinPattern {
  tapCounts: [number, number, number, number];
}

export interface StoredSpacebarSecret {
  userId: string;
  schemeVersion: "SB2";
  argon2idPhc: string;
  expectedDigits: 4;
}

export type CandidatePattern = ShiftedPinPattern;

export type VerifyPatternResult =
  | { success: true; userId: string }
  | {
      success: false;
      reason: "INVALID_PATTERN" | "NO_SECRET" | "VERIFICATION_FAILED";
    };