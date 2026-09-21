import { describe, expect, it } from 'vitest';
import { LoginOrchestrator } from '../src/orchestrator.js';
import { InMemoryPartialAuthSessionStore } from '../src/sessionManager.js';

describe('LoginOrchestrator end-to-end flow', () => {
  it('executes full sequence: begin -> Factor 2 -> Factor 1 -> Full Session', async () => {
    const store = new InMemoryPartialAuthSessionStore();
    const factor2Verifier = {
      verify: async (req: { userId: string; tapPattern: unknown }) => {
        return req.userId === 'alice' ? { verified: true } : { verified: false, reason: 'INVALID_TAP_PATTERN' };
      },
    };
    const factor1Verifier = {
      verify: async (req: { userId: string; partialSessionToken: string; assertion: unknown }) => {
        return req.userId === 'alice' ? { verified: true } : { verified: false, reason: 'INVALID_ASSERTION' };
      },
    };
    const fullSessionIssuer = {
      issue: async (userId: string) => ({ sessionToken: `full-session-${userId}` }),
    };

    const orchestrator = new LoginOrchestrator(store, factor2Verifier, factor1Verifier, fullSessionIssuer);

    // Step 1: Identity claim
    const start = orchestrator.beginLogin('alice');
    expect(start).toEqual({ userId: 'alice', next: 'FACTOR_2' });

    // Step 2: Factor 2 verification -> creates PartialAuthSession
    const f2Result = await orchestrator.verifyFactor2({ userId: 'alice', tapPattern: [6, 1, 8, 3] });
    expect(f2Result.next).toBe('FACTOR_1');
    expect(f2Result.partialSessionToken).toBeDefined();
    expect(f2Result.partialSession.status).toBe('ACTIVE');

    // Step 3: Factor 1 verification -> validates D2 gate and consumes partial session
    const f1Result = await orchestrator.verifyFactor1({
      userId: 'alice',
      partialSessionToken: f2Result.partialSessionToken,
      assertion: { credentialId: 'mock-cred' },
    });
    expect(f1Result.next).toBe('AUTHENTICATED');
    expect(f1Result.sessionToken).toBe('full-session-alice');

    // Step 4: Replaying or reusing the partial session must fail (single-use)
    await expect(
      orchestrator.verifyFactor1({
        userId: 'alice',
        partialSessionToken: f2Result.partialSessionToken,
        assertion: { credentialId: 'mock-cred' },
      })
    ).rejects.toThrow('SESSION_ALREADY_USED');
  });

  it('strictly rejects Factor 1 if Factor 2 was skipped or token is invalid (D2 Invariant)', async () => {
    const store = new InMemoryPartialAuthSessionStore();
    const factor2Verifier = {
      verify: async () => ({ verified: true }),
    };
    const factor1Verifier = {
      verify: async () => ({ verified: true }),
    };
    const fullSessionIssuer = {
      issue: async (userId: string) => ({ sessionToken: `full-${userId}` }),
    };

    const orchestrator = new LoginOrchestrator(store, factor2Verifier, factor1Verifier, fullSessionIssuer);

    await expect(
      orchestrator.verifyFactor1({
        userId: 'bob',
        partialSessionToken: 'unissued-bogus-token',
        assertion: {},
      })
    ).rejects.toThrow('SESSION_NOT_FOUND');
  });
});
