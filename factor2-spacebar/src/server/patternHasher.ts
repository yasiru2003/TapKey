import argon2 from "argon2";
import {
  ARGON2_MEMORY_COST,
  ARGON2_PARALLELISM,
  ARGON2_TIME_COST,
} from "../shared/config.js";

export async function hashPattern(canonicalPattern: string): Promise<string> {
  if (typeof canonicalPattern !== "string" || canonicalPattern.length === 0) {
    throw new TypeError("Canonical pattern must be a non-empty string");
  }

  return argon2.hash(canonicalPattern, {
    type: argon2.argon2id,
    memoryCost: ARGON2_MEMORY_COST,
    timeCost: ARGON2_TIME_COST,
    parallelism: ARGON2_PARALLELISM,
  });
}