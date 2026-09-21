export type SpacebarMode = "COUNT" | "RHYTHM";

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
  mode: SpacebarMode;
  schemeVersion: "SB1";
  argon2idPhc: string;
  expectedUnits?: number;
  thresholdMs?: number;
  toleranceMs?: number;
}

export type CandidatePattern = CountPattern | RhythmPattern;

export type VerifyPatternResult =
  | { success: true; userId: string }
  | {
      success: false;
      reason: "INVALID_PATTERN" | "NO_SECRET" | "VERIFICATION_FAILED";
    };