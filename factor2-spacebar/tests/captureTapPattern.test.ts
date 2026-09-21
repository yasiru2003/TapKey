import { describe, expect, it } from "vitest";
import { captureTapPattern } from "../src/client/captureTapPattern.js";

type Listener = (event: KeyboardEvent) => void;

class FakeElement {
  listener?: Listener;

  addEventListener(_type: string, listener: EventListenerOrEventListenerObject): void {
    this.listener = listener as Listener;
  }

  removeEventListener(): void {
    this.listener = undefined;
  }

  press(code: string, repeat = false): { prevented: boolean } {
    let prevented = false;
    this.listener?.({
      code,
      repeat,
      preventDefault: () => { prevented = true; },
    } as KeyboardEvent);
    return { prevented };
  }
}

describe("shifted PIN capture", () => {
  it("advances through the four-digit PIN flow and emits ready state", () => {
    const element = new FakeElement();
    const prompts: string[] = [];
    const recorded: number[] = [];
    const ready: number[][] = [];
    const capture = captureTapPattern(element, {
      onDigitPrompt: (message) => prompts.push(message),
      onDigitRecorded: (digitIndex) => recorded.push(digitIndex),
      onPatternReady: (pattern) => {
        if ("tapCounts" in pattern) ready.push(pattern.tapCounts);
      },
    });

    expect(prompts[0]).toBe("Enter first digit.");
    expect(element.press("Space").prevented).toBe(true);
    expect(element.press("Space").prevented).toBe(true);
    expect(element.press("Enter")).toEqual({ prevented: false });
    expect(recorded).toEqual([1]);
    expect(prompts.at(-1)).toBe("First digit recorded. Enter second digit.");

    element.press("Space");
    element.press("Space");
    element.press("Space");
    element.press("Enter");
    expect(recorded).toEqual([1, 2]);

    element.press("Space");
    element.press("Space");
    element.press("Space");
    element.press("Space");
    element.press("Space");
    element.press("Space");
    element.press("Space");
    element.press("Space");
    element.press("Enter");
    expect(recorded).toEqual([1, 2, 3]);

    element.press("Space");
    element.press("Space");
    element.press("Space");
    element.press("Enter");
    expect(ready).toEqual([[2, 3, 8, 3]]);

    element.press("Space");
    expect(ready).toEqual([[2, 3, 8, 3]]);

    capture.detach();
    element.press("Space");
    expect(ready).toEqual([[2, 3, 8, 3]]);
  });

  it("ignores repeats, invalid zero taps, too many taps, and resets entire PIN", () => {
    const element = new FakeElement();
    const prompts: string[] = [];
    const errors: string[] = [];
    const capture = captureTapPattern(element, {
      onDigitPrompt: (message) => prompts.push(message),
      onValidationError: (error) => errors.push(error.message),
    });

    element.press("Enter");
    expect(errors).toContain("Digit not entered. Use between one and ten spacebar presses.");
    expect(prompts.at(-1)).toBe("Enter first digit.");

    for (let index = 0; index < 11; index += 1) {
      element.press("Space");
    }
    expect(errors).toContain("Too many taps for this digit. Press Escape to restart.");

    element.press("Escape");
    expect(prompts.at(-1)).toBe("Enter first digit.");
    capture.detach();
  });

  it("ignores non-spacebar keys when inactive", () => {
    const element = new FakeElement();
    let count = 0;
    const capture = captureTapPattern(element, {
      onDigitRecorded: () => { count += 1; },
    });
    element.press("KeyA");
    expect(count).toBe(0);
    capture.detach();
    element.press("Space");
    expect(count).toBe(0);
  });
});

describe("spacebar capture in COUNT mode", () => {
  it("captures taps, ignores repeats, completes groups, and resets", () => {
    const element = new FakeElement();
    const completed: number[][] = [];
    const resets: number[] = [];
    const capture = captureTapPattern(element, {
      mode: "COUNT",
      onGroupCompleted: (groups) => completed.push(groups),
      onReset: () => resets.push(1),
    });

    expect(element.press("Space").prevented).toBe(true);
    element.press("Space", true);
    element.press("Space");
    element.press("Enter");
    expect(completed).toEqual([[2]]);
    expect(resets).toEqual([]);
    element.press("Escape");
    expect(resets).toHaveLength(1);
    capture.detach();
    element.press("Space");
    expect(completed).toEqual([[2]]);
  });

  it("ignores unrelated keys and inactive elements", () => {
    const element = new FakeElement();
    const taps: number[] = [];
    const capture = captureTapPattern(element, { mode: "COUNT", onTap: (count) => taps.push(count) });
    element.press("KeyA");
    expect(taps).toEqual([]);
    capture.detach();
    element.press("Space");
    expect(taps).toEqual([]);
  });
});