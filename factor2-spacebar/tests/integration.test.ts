import { describe, expect, it } from "vitest";
<<<<<<< HEAD
import { canonicalizeShiftedPin } from "../src/shared/canonicalize.js";
=======
import { canonicalizeCountPattern } from "../src/shared/canonicalize.js";
>>>>>>> 5382501e8c22ef80dc1321e6f6ccce8ea6408a50
import { hashPattern } from "../src/server/patternHasher.js";
import { InMemorySpacebarSecretRepository } from "../src/server/SpacebarSecretRepository.js";
import { verifyPattern } from "../src/server/patternVerifier.js";

describe("Factor 2 integration boundary", () => {
  it("returns a verification result without creating sessions", async () => {
    const repository = new InMemorySpacebarSecretRepository();
<<<<<<< HEAD
    const tapCounts = [6, 1, 8, 3];
    await repository.save({
      userId: "user-1",
      schemeVersion: "SB2",
      argon2idPhc: await hashPattern(canonicalizeShiftedPin(tapCounts)),
      expectedDigits: 4,
    });

    await expect(verifyPattern("user-1", { tapCounts }, repository))
=======
    await repository.save({
      userId: "user-1",
      mode: "COUNT",
      schemeVersion: "SB1",
      argon2idPhc: await hashPattern(canonicalizeCountPattern([3, 1, 4, 2])),
      expectedUnits: 4,
    });

    await expect(verifyPattern("user-1", { mode: "COUNT", groups: [3, 1, 4, 2] }, repository))
>>>>>>> 5382501e8c22ef80dc1321e6f6ccce8ea6408a50
      .resolves.toEqual({ success: true, userId: "user-1" });
    expect(repository).not.toHaveProperty("createPartialAuthSession");
    expect(repository).not.toHaveProperty("createWebAuthnCredential");
    expect(repository).not.toHaveProperty("createAuthenticatedSession");
  });
});