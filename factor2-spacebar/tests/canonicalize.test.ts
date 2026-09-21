import { describe, expect, it } from "vitest";
import {
  canonicalizeCountPattern,
  canonicalizeRhythmPattern,
  canonicalizeShiftedPin,
} from "../src/shared/canonicalize.js";

describe("shifted PIN canonicalization", () => {
  it("encodes the shifted PIN deterministically", () => {
    expect(canonicalizeShiftedPin([6, 1, 8, 3])).toBe("SB2|PIN|5072");
    expect(canonicalizeShiftedPin([1, 1, 1, 1])).toBe("SB2|PIN|0000");
    expect(canonicalizeShiftedPin([10, 10, 10, 10])).toBe("SB2|PIN|9999");
    expect(canonicalizeShiftedPin([2, 3, 4, 5])).toBe("SB2|PIN|1234");
  });

  it.each([
    [],
    [1],
    [1, 2, 3],
    [1, 2, 3, 4, 5],
    [0, 1, 1, 1],
    [11, 1, 1, 1],
    [-1, 1, 1, 1],
    [1.5, 1, 1, 1],
    [Number.NaN, 1, 1, 1],
  ])("rejects %j", (tapCounts) => {
    expect(() => canonicalizeShiftedPin(tapCounts)).toThrow();
  });
});

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