import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { canonicalizeShiftedPin } from "../src/shared/canonicalize.js";
import { hashPattern } from "../src/server/patternHasher.js";
import { InMemorySpacebarSecretRepository } from "../src/server/SpacebarSecretRepository.js";
import { verifyPattern } from "../src/server/patternVerifier.js";
import type { CandidatePattern, StoredSpacebarSecret } from "../src/shared/types.js";

const PORT = 5181;
const repository = new InMemorySpacebarSecretRepository();

function readJson(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk: Buffer) => { body += chunk.toString(); });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    request.on("error", reject);
  });
}

function writeJson(response: ServerResponse, statusCode: number, body: { success: boolean }): void {
  response.writeHead(statusCode, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

function isCandidate(value: unknown): value is CandidatePattern {
  if (!value || typeof value !== "object" || !("tapCounts" in value)) return false;
  const candidate = value as Record<string, unknown>;
  return Array.isArray(candidate.tapCounts) && candidate.tapCounts.length === 4 && candidate.tapCounts.every((item) => typeof item === "number" && Number.isFinite(item));
}

function isPayload(value: unknown): value is { userId: string; candidate: CandidatePattern } {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  return typeof payload.userId === "string" && payload.userId.length > 0 && isCandidate(payload.candidate);
}

async function enroll(userId: string, candidate: CandidatePattern): Promise<void> {
  const canonical = canonicalizeShiftedPin(candidate.tapCounts);
  const secret: StoredSpacebarSecret = {
    userId,
    schemeVersion: "SB2",
    argon2idPhc: await hashPattern(canonical),
    expectedDigits: 4,
  };
  await repository.save(secret);
}

const server = createServer(async (request, response) => {
  const path = request.url?.split("?", 1)[0];
  if (request.method !== "POST" || (path !== "/api/demo/enroll" && path !== "/api/demo/verify")) {
    writeJson(response, 404, { success: false });
    return;
  }

  try {
    const payload = await readJson(request);
    if (!isPayload(payload)) {
      writeJson(response, 400, { success: false });
      return;
    }

    if (path === "/api/demo/enroll") {
      await enroll(payload.userId, payload.candidate);
      writeJson(response, 200, { success: true });
      return;
    }

    const result = await verifyPattern(payload.userId, payload.candidate, repository);
    writeJson(response, 200, { success: result.success });
  } catch {
    writeJson(response, 400, { success: false });
  }
});

server.listen(PORT, () => {
  console.log(`Factor 2 demo API listening on http://localhost:${PORT}`);
});