import {
  MAX_TAPS_PER_DIGIT,
  MIN_TAPS_PER_DIGIT,
  PIN_DIGIT_COUNT,
  MAX_TAPS_PER_GROUP,
} from "./config.js";
import {
  AmbiguousRhythmError,
  InvalidCountPatternError,
  InvalidPinPatternError,
  InvalidRhythmPatternError,
} from "./errors.js";

export function canonicalizeShiftedPin(tapCounts: readonly number[]): string {
  if (!Array.isArray(tapCounts) || tapCounts.length !== PIN_DIGIT_COUNT) {
    throw new InvalidPinPatternError();
  }

  for (const tapCount of tapCounts) {
    if (
      !Number.isInteger(tapCount) ||
      tapCount < MIN_TAPS_PER_DIGIT ||
      tapCount > MAX_TAPS_PER_DIGIT
    ) {
      throw new InvalidPinPatternError();
    }
  }

  const digits = tapCounts.map((tapCount) => String(tapCount - 1)).join("");
  return `SB2|PIN|${digits}`;
}

export function canonicalizeCountPattern(groups: readonly number[]): string {
  if (!Array.isArray(groups) || groups.length === 0) {
    throw new InvalidCountPatternError();
  }

  for (const count of groups) {
    if (!Number.isInteger(count) || count < 1 || count > MAX_TAPS_PER_GROUP) {
      throw new InvalidCountPatternError();
    }
  }

  return `SB1|COUNT|${groups.join(",")}`;
}

export function canonicalizeRhythmPattern(
  timestamps: readonly number[],
  thresholdMs: number,
  toleranceMs: number,
): string {
  if (
    !Array.isArray(timestamps) ||
    timestamps.length < 2 ||
    !Number.isFinite(thresholdMs) ||
    thresholdMs <= 0 ||
    !Number.isFinite(toleranceMs) ||
    toleranceMs < 0 ||
    toleranceMs >= thresholdMs
  ) {
    throw new InvalidRhythmPatternError();
  }

  for (let index = 0; index < timestamps.length; index += 1) {
    const timestamp = timestamps[index];
    if (!Number.isFinite(timestamp) || (index > 0 && timestamp <= timestamps[index - 1])) {
      throw new InvalidRhythmPatternError();
    }
  }

  const shortLimit = thresholdMs - toleranceMs;
  const longLimit = thresholdMs + toleranceMs;
  const sequence = timestamps.slice(1).map((timestamp, index) => {
    const gap = timestamp - timestamps[index];
    if (gap <= shortLimit) return "S";
    if (gap >= longLimit) return "L";
    throw new AmbiguousRhythmError();
  });

  return `SB1|RHYTHM|${sequence.join("")}`;
}