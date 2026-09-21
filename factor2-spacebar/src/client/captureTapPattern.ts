<<<<<<< HEAD
import { PIN_DIGIT_COUNT } from "../shared/config.js";
import type { ShiftedPinPattern } from "../shared/types.js";

export interface CaptureCallbacks {
  onDigitPrompt?: (message: string) => void;
  onDigitRecorded?: (digitIndex: number) => void;
  onPatternReady?: (pattern: ShiftedPinPattern) => void;
=======
import { canonicalizeCountPattern, canonicalizeRhythmPattern } from "../shared/canonicalize.js";
import type { CountPattern, RhythmPattern, SpacebarMode } from "../shared/types.js";

export interface CaptureCallbacks {
  onTap?: (count: number) => void;
  onGroupCompleted?: (groups: number[]) => void;
  onPatternReady?: (pattern: CountPattern | RhythmPattern) => void;
>>>>>>> 5382501e8c22ef80dc1321e6f6ccce8ea6408a50
  onReset?: () => void;
  onValidationError?: (error: Error) => void;
}

export interface CaptureOptions extends CaptureCallbacks {
<<<<<<< HEAD
=======
  mode: SpacebarMode;
  thresholdMs?: number;
  toleranceMs?: number;
>>>>>>> 5382501e8c22ef80dc1321e6f6ccce8ea6408a50
  now?: () => number;
}

export interface TapPatternCapture {
  detach(): void;
  reset(): void;
}

<<<<<<< HEAD
const PROMPTS = [
  "Enter first digit.",
  "First digit recorded. Enter second digit.",
  "Second digit recorded. Enter third digit.",
  "Third digit recorded. Enter fourth digit.",
  "Fourth digit recorded. PIN ready for verification.",
];

export function captureTapPattern(
  element: Pick<HTMLElement, "addEventListener" | "removeEventListener">,
  options: CaptureOptions = {},
): TapPatternCapture {
  let digitIndex = 0;
  let currentTapCount = 0;
  let digits: number[] = [];
  let blocked = false;

  const reset = (): void => {
    digitIndex = 0;
    currentTapCount = 0;
    digits = [];
    blocked = false;
    options.onReset?.();
    options.onDigitPrompt?.(PROMPTS[0]);
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat || !["Space", "Enter", "Escape"].includes(event.code)) {
      return;
    }

    if (event.code === "Space") {
      event.preventDefault();
      if (blocked) {
        return;
      }
      currentTapCount += 1;
      if (currentTapCount > 10) {
        blocked = true;
        currentTapCount = 0;
        options.onValidationError?.(
          new Error("Too many taps for this digit. Press Escape to restart."),
        );
=======
export function captureTapPattern(
  element: Pick<HTMLElement, "addEventListener" | "removeEventListener">,
  options: CaptureOptions,
): TapPatternCapture {
  let currentGroup = 0;
  let groups: number[] = [];
  let timestamps: number[] = [];
  const now = options.now ?? (() => performance.now());

  const reset = (): void => {
    currentGroup = 0;
    groups = [];
    timestamps = [];
    options.onReset?.();
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat || !["Space", "Enter", "Escape"].includes(event.code)) return;

    if (event.code === "Space") {
      event.preventDefault();
      if (options.mode === "COUNT") {
        currentGroup += 1;
        options.onTap?.(currentGroup);
      } else {
        timestamps.push(now());
        options.onTap?.(timestamps.length);
>>>>>>> 5382501e8c22ef80dc1321e6f6ccce8ea6408a50
      }
      return;
    }

    if (event.code === "Escape") {
      reset();
      return;
    }

<<<<<<< HEAD
    if (blocked) {
      return;
    }

    if (currentTapCount < 1 || currentTapCount > 10) {
      options.onValidationError?.(
        new Error("Digit not entered. Use between one and ten spacebar presses."),
      );
      return;
    }

    digits.push(currentTapCount);
    currentTapCount = 0;
    digitIndex += 1;
    options.onDigitRecorded?.(digitIndex);

    if (digits.length < PIN_DIGIT_COUNT) {
      options.onDigitPrompt?.(PROMPTS[digitIndex]);
      return;
    }

    const pattern: ShiftedPinPattern = { tapCounts: digits as [number, number, number, number] };
    options.onPatternReady?.(pattern);
    options.onDigitPrompt?.(PROMPTS[PIN_DIGIT_COUNT]);
    blocked = true;
  };

  element.addEventListener("keydown", handleKeyDown);
  reset();

  return {
    detach: () => element.removeEventListener("keydown", handleKeyDown),
    reset,
  };
=======
    try {
      if (options.mode === "COUNT") {
        if (currentGroup === 0) return;
        groups = [...groups, currentGroup];
        currentGroup = 0;
        options.onGroupCompleted?.([...groups]);
        canonicalizeCountPattern(groups);
        options.onPatternReady?.({ mode: "COUNT", groups: [...groups] });
      } else {
        if (options.thresholdMs === undefined || options.toleranceMs === undefined) {
          throw new Error("Rhythm configuration is required");
        }
        canonicalizeRhythmPattern(timestamps, options.thresholdMs, options.toleranceMs);
        options.onPatternReady?.({
          mode: "RHYTHM",
          timestamps: [...timestamps],
          thresholdMs: options.thresholdMs,
          toleranceMs: options.toleranceMs,
        });
      }
    } catch (error) {
      options.onValidationError?.(error instanceof Error ? error : new Error("Invalid pattern"));
    }
  };

  element.addEventListener("keydown", handleKeyDown);
  return { detach: () => element.removeEventListener("keydown", handleKeyDown), reset };
>>>>>>> 5382501e8c22ef80dc1321e6f6ccce8ea6408a50
}