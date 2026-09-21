export type SpacebarMode = "COUNT" | "RHYTHM" | "PIN";

export interface ShiftedPinPattern {
  tapCounts: [number, number, number, number];
}

export interface CountPattern {
  mode: "COUNT";
  groups: number[];
}

export interface RhythmPattern {
  mode: "RHYTHM";
  timestamps: number[];
  thresholdMs: number;
  toleranceMs: number;
}

export interface StoredSpacebarSecret {
  userId: string;
  mode?: SpacebarMode;
  schemeVersion: "SB1" | "SB2";
  argon2idPhc: string;
  expectedUnits?: number;
  expectedDigits?: number;
  thresholdMs?: number;
  toleranceMs?: number;
}

export type CandidatePattern =
  | ShiftedPinPattern
  | CountPattern
  | RhythmPattern;

export type VerifyPatternResult =
  | { success: true; userId: string }
  | {
      success: false;
      reason: "INVALID_PATTERN" | "NO_SECRET" | "VERIFICATION_FAILED";
    };