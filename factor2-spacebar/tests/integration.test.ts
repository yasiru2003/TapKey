import { describe, expect, it } from "vitest";
import { canonicalizeCountPattern } from "../src/shared/canonicalize.js";
import { hashPattern } from "../src/server/patternHasher.js";
import { InMemorySpacebarSecretRepository } from "../src/server/SpacebarSecretRepository.js";
import { verifyPattern } from "../src/server/patternVerifier.js";

describe("Factor 2 integration boundary", () => {
  it("returns a verification result without creating sessions", async () => {
    const repository = new InMemorySpacebarSecretRepository();
    await repository.save({
      userId: "user-1",
      mode: "COUNT",
      schemeVersion: "SB1",
      argon2idPhc: await hashPattern(canonicalizeCountPattern([3, 1, 4, 2])),
      expectedUnits: 4,
    });

    await expect(verifyPattern("user-1", { mode: "COUNT", groups: [3, 1, 4, 2] }, repository))
      .resolves.toEqual({ success: true, userId: "user-1" });
    expect(repository).not.toHaveProperty("createPartialAuthSession");
    expect(repository).not.toHaveProperty("createWebAuthnCredential");
    expect(repository).not.toHaveProperty("createAuthenticatedSession");
  });
});