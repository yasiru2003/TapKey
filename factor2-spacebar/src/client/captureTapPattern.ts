import { canonicalizeCountPattern, canonicalizeRhythmPattern } from "../shared/canonicalize.js";
import type { CountPattern, RhythmPattern, SpacebarMode } from "../shared/types.js";

export interface CaptureCallbacks {
  onTap?: (count: number) => void;
  onGroupCompleted?: (groups: number[]) => void;
  onPatternReady?: (pattern: CountPattern | RhythmPattern) => void;
  onReset?: () => void;
  onValidationError?: (error: Error) => void;
}

export interface CaptureOptions extends CaptureCallbacks {
  mode: SpacebarMode;
  thresholdMs?: number;
  toleranceMs?: number;
  now?: () => number;
}

export interface TapPatternCapture {
  detach(): void;
  reset(): void;
}

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
      }
      return;
    }

    if (event.code === "Escape") {
      reset();
      return;
    }

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
}