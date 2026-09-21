import { describe, expect, it } from "vitest";
import { canonicalizeShiftedPin } from "../src/shared/canonicalize.js";

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