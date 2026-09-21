import type { PartialAuthSessionStore, PartialAuthSession } from './sessionManager.js';

export interface Factor2VerificationRequest {
  userId: string;
  tapPattern: unknown;
}

export interface Factor2Verifier {
  verify(request: Factor2VerificationRequest): Promise<{ verified: boolean; reason?: string }>;
}

export interface Factor1VerificationRequest {
  userId: string;
  partialSessionToken: string;
  assertion: unknown;
}

export interface Factor1Verifier {
  verify(request: Factor1VerificationRequest): Promise<{ verified: boolean; reason?: string }>;
}

export interface FullSessionIssuer {
  issue(userId: string): Promise<{ sessionToken: string; expiresAt?: Date }>;
}

export interface LoginStartedResponse {
  userId: string;
  next: 'FACTOR_2';
}

export interface Factor2SuccessResponse {
  next: 'FACTOR_1';
  partialSession: Pick<PartialAuthSession, 'id' | 'userId' | 'createdAt' | 'expiresAt' | 'status'>;
  partialSessionToken: string;
}

export interface LoginSuccessResponse {
  next: 'AUTHENTICATED';
  sessionToken: string;
  expiresAt?: Date;
}

export class LoginOrchestrator {
  constructor(
    private readonly sessions: PartialAuthSessionStore,
    private readonly factor2: Factor2Verifier,
    private readonly factor1: Factor1Verifier,
    private readonly fullSessions: FullSessionIssuer,
  ) {}

  beginLogin(userId: string): LoginStartedResponse {
    if (!userId.trim()) throw new Error('userId is required');
    return { userId, next: 'FACTOR_2' };
  }

  async verifyFactor2(request: Factor2VerificationRequest): Promise<Factor2SuccessResponse> {
    const result = await this.factor2.verify(request);
    if (!result.verified) throw new Error(result.reason ?? 'FACTOR_2_REJECTED');
    const created = await this.sessions.create(request.userId);
    return { next: 'FACTOR_1', partialSession: created.session, partialSessionToken: created.token };
  }

  async verifyFactor1(request: Factor1VerificationRequest): Promise<LoginSuccessResponse> {
    const gate = await this.sessions.validate(request.partialSessionToken, request.userId);
    if (!gate.isValid) throw new Error(gate.reason ?? 'INVALID_PARTIAL_SESSION');

    const result = await this.factor1.verify(request);
    if (!result.verified) throw new Error(result.reason ?? 'FACTOR_1_REJECTED');

    const fullSession = await this.fullSessions.issue(request.userId);
    await this.sessions.consume(request.partialSessionToken);
    return { next: 'AUTHENTICATED', ...fullSession };
  }
}