import { describe, expect, it } from "vitest";
import { canonicalizeCountPattern, canonicalizeRhythmPattern } from "../src/shared/canonicalize.js";

describe("count canonicalization", () => {
  it("encodes count groups deterministically", () => {
    expect(canonicalizeCountPattern([3, 1, 4, 2])).toBe("SB1|COUNT|3,1,4,2");
  });

  it.each([[], [0, 2, 3], [-1, 2], [1.5, 2], [21]])("rejects %j", (groups) => {
    expect(() => canonicalizeCountPattern(groups)).toThrow();
  });
});

describe("rhythm canonicalization", () => {
  it("encodes short, long, and mixed rhythms", () => {
    expect(canonicalizeRhythmPattern([0, 100, 200], 300, 50)).toBe("SB1|RHYTHM|SS");
    expect(canonicalizeRhythmPattern([0, 600, 1200], 300, 50)).toBe("SB1|RHYTHM|LL");
    expect(canonicalizeRhythmPattern([0, 100, 700, 800], 300, 50)).toBe("SB1|RHYTHM|SLS");
  });

  it.each([
    [0, 0],
    [Number.NaN, 100],
    [0, Number.POSITIVE_INFINITY],
  ])("rejects invalid timestamps %j", (first, second) => {
    expect(() => canonicalizeRhythmPattern([first, second], 300, 50)).toThrow();
  });

  it("rejects non-increasing timestamps, ambiguous gaps, and invalid configuration", () => {
    expect(() => canonicalizeRhythmPattern([0, 100, 90], 300, 50)).toThrow();
    expect(() => canonicalizeRhythmPattern([0, 275], 300, 50)).toThrow();
    expect(() => canonicalizeRhythmPattern([0], 300, 50)).toThrow();
    expect(() => canonicalizeRhythmPattern([0, 100], 0, 0)).toThrow();
    expect(() => canonicalizeRhythmPattern([0, 100], 300, -1)).toThrow();
    expect(() => canonicalizeRhythmPattern([0, 100], 300, 300)).toThrow();
  });
});