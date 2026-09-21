import { describe, expect, it } from "vitest";
import { captureTapPattern } from "../src/client/captureTapPattern.js";

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