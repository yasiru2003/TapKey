import {
  MAX_TAPS_PER_DIGIT,
  MIN_TAPS_PER_DIGIT,
  PIN_DIGIT_COUNT,
} from "./config.js";
import { InvalidPinPatternError } from "./errors.js";

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