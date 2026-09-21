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
    this.listener?.({ code, repeat, preventDefault: () => { prevented = true; } } as KeyboardEvent);
    return { prevented };
  }
}

describe("digit state progression", () => {
  it("tracks the four-digit entry state without leaking values", () => {
    const element = new FakeElement();
    const prompts: string[] = [];
    const result: number[][] = [];
    captureTapPattern(element, {
      onDigitPrompt: (message) => prompts.push(message),
      onPatternReady: (pattern) => {
        if ("tapCounts" in pattern) result.push(pattern.tapCounts);
      },
    });

    expect(prompts[0]).toBe("Enter first digit.");
    for (let index = 0; index < 6; index += 1) {
      element.press("Space");
    }
    element.press("Enter");
    expect(result).toEqual([]);
    expect(prompts.at(-1)).toBe("First digit recorded. Enter second digit.");

    for (let index = 0; index < 1; index += 1) {
      element.press("Space");
    }
    element.press("Enter");
    expect(prompts.at(-1)).toBe("Second digit recorded. Enter third digit.");

    for (let index = 0; index < 8; index += 1) {
      element.press("Space");
    }
    element.press("Enter");
    expect(prompts.at(-1)).toBe("Third digit recorded. Enter fourth digit.");

    for (let index = 0; index < 3; index += 1) {
      element.press("Space");
    }
    element.press("Enter");
    expect(result).toEqual([[6, 1, 8, 3]]);
    expect(prompts.at(-1)).toBe("Fourth digit recorded. PIN ready for verification.");
  });
});

describe("rhythm capture", () => {
  it("emits a rhythm candidate on Enter", () => {
    const listeners: Array<(event: KeyboardEvent) => void> = [];
    const element = {
      addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        listeners.push(listener as (event: KeyboardEvent) => void);
      },
      removeEventListener: () => undefined,
    };
    const ready: unknown[] = [];
    let time = 0;
    captureTapPattern(element, {
      mode: "RHYTHM",
      thresholdMs: 300,
      toleranceMs: 50,
      now: () => time,
      onPatternReady: (pattern) => ready.push(pattern),
    });
    const press = (code: string) => listeners[0]({ code, repeat: false, preventDefault: () => undefined } as KeyboardEvent);
    press("Space");
    time = 100;
    press("Space");
    press("Enter");
    expect(ready).toEqual([{ mode: "RHYTHM", timestamps: [0, 100], thresholdMs: 300, toleranceMs: 50 }]);
  });
});