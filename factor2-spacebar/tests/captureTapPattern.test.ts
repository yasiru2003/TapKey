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

describe("spacebar capture", () => {
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