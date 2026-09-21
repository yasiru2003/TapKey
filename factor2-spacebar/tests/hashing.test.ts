import { describe, expect, it } from "vitest";
import argon2 from "argon2";
import { hashPattern } from "../src/server/patternHasher.js";

describe("Argon2id hashing", () => {
  it("creates independently salted hashes that verify", async () => {
<<<<<<< HEAD
    const pattern = "SB2|PIN|5072";
=======
    const pattern = "SB1|COUNT|3,1,4,2";
>>>>>>> 5382501e8c22ef80dc1321e6f6ccce8ea6408a50
    const first = await hashPattern(pattern);
    const second = await hashPattern(pattern);

    expect(first.startsWith("$argon2id$")).toBe(true);
    expect(first).not.toBe(second);
    await expect(argon2.verify(first, pattern)).resolves.toBe(true);
    await expect(argon2.verify(second, pattern)).resolves.toBe(true);
<<<<<<< HEAD
    await expect(argon2.verify(first, "SB2|PIN|5073")).resolves.toBe(false);
=======
    await expect(argon2.verify(first, "SB1|COUNT|3,1,4,3")).resolves.toBe(false);
>>>>>>> 5382501e8c22ef80dc1321e6f6ccce8ea6408a50
  });
});