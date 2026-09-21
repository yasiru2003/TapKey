import { describe, expect, it } from "vitest";
import { canonicalizeShiftedPin } from "../src/shared/canonicalize.js";
import { hashPattern } from "../src/server/patternHasher.js";
import { InMemorySpacebarSecretRepository } from "../src/server/SpacebarSecretRepository.js";
import { verifyPattern } from "../src/server/patternVerifier.js";

describe("Factor 2 integration boundary", () => {
  it("returns a verification result without creating sessions", async () => {
    const repository = new InMemorySpacebarSecretRepository();
    const tapCounts = [6, 1, 8, 3];
    await repository.save({
      userId: "user-1",
      schemeVersion: "SB2",
      argon2idPhc: await hashPattern(canonicalizeShiftedPin(tapCounts)),
      expectedDigits: 4,
    });

    await expect(verifyPattern("user-1", { tapCounts }, repository))
      .resolves.toEqual({ success: true, userId: "user-1" });
    expect(repository).not.toHaveProperty("createPartialAuthSession");
    expect(repository).not.toHaveProperty("createWebAuthnCredential");
    expect(repository).not.toHaveProperty("createAuthenticatedSession");
  });
});