import { PIN_DIGIT_COUNT } from "../shared/config.js";
import { canonicalizeCountPattern, canonicalizeRhythmPattern } from "../shared/canonicalize.js";
import type {
  CandidatePattern,
  CountPattern,
  RhythmPattern,
  ShiftedPinPattern,
  SpacebarMode,
} from "../shared/types.js";

export interface CaptureCallbacks {
  onDigitPrompt?: (message: string) => void;
  onDigitRecorded?: (digitIndex: number) => void;
  onTap?: (count: number) => void;
  onGroupCompleted?: (groups: number[]) => void;
  onPatternReady?: (pattern: CandidatePattern) => void;
  onReset?: () => void;
  onValidationError?: (error: Error) => void;
}

export interface CaptureOptions extends CaptureCallbacks {
  mode?: SpacebarMode;
  thresholdMs?: number;
  toleranceMs?: number;
  now?: () => number;
}

export interface TapPatternCapture {
  detach(): void;
  reset(): void;
}

const PIN_PROMPTS = [
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
  const mode = options.mode ?? (options.onDigitPrompt || options.onDigitRecorded ? "PIN" : "PIN");
  const now = options.now ?? (() => performance.now());

  let digitIndex = 0;
  let currentTapCount = 0;
  let digits: number[] = [];
  let blocked = false;

  let currentGroup = 0;
  let groups: number[] = [];
  let timestamps: number[] = [];

  const reset = (): void => {
    digitIndex = 0;
    currentTapCount = 0;
    digits = [];
    blocked = false;

    currentGroup = 0;
    groups = [];
    timestamps = [];

    options.onReset?.();
    if (mode === "PIN") {
      options.onDigitPrompt?.(PIN_PROMPTS[0]);
    }
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat || !["Space", "Enter", "Escape"].includes(event.code)) {
      return;
    }

    if (event.code === "Space") {
      event.preventDefault();

      if (mode === "PIN") {
        if (blocked) return;
        currentTapCount += 1;
        if (currentTapCount > 10) {
          blocked = true;
          currentTapCount = 0;
          options.onValidationError?.(
            new Error("Too many taps for this digit. Press Escape to restart."),
          );
        }
      } else if (mode === "COUNT") {
        currentGroup += 1;
        options.onTap?.(currentGroup);
      } else if (mode === "RHYTHM") {
        timestamps.push(now());
        options.onTap?.(timestamps.length);
      }
      return;
    }

    if (event.code === "Escape") {
      reset();
      return;
    }

    if (event.code === "Enter") {
      if (mode === "PIN") {
        if (blocked) return;

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
          options.onDigitPrompt?.(PIN_PROMPTS[digitIndex]);
          return;
        }

        const pattern: ShiftedPinPattern = { tapCounts: digits as [number, number, number, number] };
        options.onPatternReady?.(pattern);
        options.onDigitPrompt?.(PIN_PROMPTS[PIN_DIGIT_COUNT]);
        blocked = true;
      } else if (mode === "COUNT") {
        try {
          if (currentGroup === 0) return;
          groups = [...groups, currentGroup];
          currentGroup = 0;
          options.onGroupCompleted?.([...groups]);
          canonicalizeCountPattern(groups);
          const pattern: CountPattern = { mode: "COUNT", groups: [...groups] };
          options.onPatternReady?.(pattern);
        } catch (error) {
          options.onValidationError?.(error instanceof Error ? error : new Error("Invalid pattern"));
        }
      } else if (mode === "RHYTHM") {
        try {
          if (options.thresholdMs === undefined || options.toleranceMs === undefined) {
            throw new Error("Rhythm configuration is required");
          }
          canonicalizeRhythmPattern(timestamps, options.thresholdMs, options.toleranceMs);
          const pattern: RhythmPattern = {
            mode: "RHYTHM",
            timestamps: [...timestamps],
            thresholdMs: options.thresholdMs,
            toleranceMs: options.toleranceMs,
          };
          options.onPatternReady?.(pattern);
        } catch (error) {
          options.onValidationError?.(error instanceof Error ? error : new Error("Invalid pattern"));
        }
      }
    }
  };

  element.addEventListener("keydown", handleKeyDown);
  if (mode === "PIN") {
    options.onDigitPrompt?.(PIN_PROMPTS[0]);
  }

  return {
    detach: () => element.removeEventListener("keydown", handleKeyDown),
    reset,
  };
}