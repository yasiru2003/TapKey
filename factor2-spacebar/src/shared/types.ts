<<<<<<< HEAD
export interface ShiftedPinPattern {
  tapCounts: [number, number, number, number];
=======
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
>>>>>>> 5382501e8c22ef80dc1321e6f6ccce8ea6408a50
}

export interface StoredSpacebarSecret {
  userId: string;
<<<<<<< HEAD
  schemeVersion: "SB2";
  argon2idPhc: string;
  expectedDigits: 4;
}

export type CandidatePattern = ShiftedPinPattern;
=======
  mode: SpacebarMode;
  schemeVersion: "SB1";
  argon2idPhc: string;
  expectedUnits?: number;
  thresholdMs?: number;
  toleranceMs?: number;
}

export type CandidatePattern = CountPattern | RhythmPattern;
>>>>>>> 5382501e8c22ef80dc1321e6f6ccce8ea6408a50

export type VerifyPatternResult =
  | { success: true; userId: string }
  | {
      success: false;
      reason: "INVALID_PATTERN" | "NO_SECRET" | "VERIFICATION_FAILED";
    };