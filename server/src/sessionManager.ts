import { createHash, randomBytes } from 'node:crypto';

export const PARTIAL_SESSION_TTL_MS = 5 * 60 * 1000;

export type PartialAuthSessionStatus = 'ACTIVE' | 'EXPIRED' | 'CONSUMED';

export interface PartialAuthSession {
  id: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  status: PartialAuthSessionStatus;
}

export interface PartialSessionValidationResult {
  isValid: boolean;
  reason?: 'SESSION_NOT_FOUND' | 'SESSION_EXPIRED' | 'SESSION_USER_MISMATCH' | 'SESSION_ALREADY_USED';
  expiresAt?: Date;
  userId?: string;
}

export interface PartialAuthSessionStore {
  create(userId: string, now?: Date): Promise<{ session: PartialAuthSession; token: string }>;
  validate(token: string, userId: string, now?: Date): Promise<PartialSessionValidationResult>;
  validatePartialSession(token: string, userId: string, now?: Date): Promise<PartialSessionValidationResult>;
  expire(token: string, now?: Date): Promise<boolean>;
  consume(token: string, now?: Date): Promise<boolean>;
}

interface StoredSession extends PartialAuthSession {
  tokenHash: string;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export class InMemoryPartialAuthSessionStore implements PartialAuthSessionStore {
  private readonly sessions = new Map<string, StoredSession>();

  async create(userId: string, now = new Date()): Promise<{ session: PartialAuthSession; token: string }> {
    if (!userId.trim()) throw new Error('userId is required');

    const token = randomBytes(32).toString('base64url');
    const session: StoredSession = {
      id: randomBytes(16).toString('hex'),
      userId,
      createdAt: new Date(now),
      expiresAt: new Date(now.getTime() + PARTIAL_SESSION_TTL_MS),
      status: 'ACTIVE',
      tokenHash: hashToken(token),
    };
    this.sessions.set(session.tokenHash, session);

    const { tokenHash: _, ...publicSession } = session;
    return { session: publicSession, token };
  }

  async validate(token: string, userId: string, now = new Date()): Promise<PartialSessionValidationResult> {
    const session = this.sessions.get(hashToken(token));
    if (!session) return { isValid: false, reason: 'SESSION_NOT_FOUND' };
    if (session.userId !== userId) return { isValid: false, reason: 'SESSION_USER_MISMATCH', userId: session.userId };
    if (session.status === 'CONSUMED') return { isValid: false, reason: 'SESSION_ALREADY_USED', userId: session.userId };
    if (session.status === 'EXPIRED' || now.getTime() >= session.expiresAt.getTime()) {
      session.status = 'EXPIRED';
      return { isValid: false, reason: 'SESSION_EXPIRED', expiresAt: session.expiresAt, userId: session.userId };
    }
    return { isValid: true, expiresAt: session.expiresAt, userId: session.userId };
  }

  async validatePartialSession(token: string, userId: string, now = new Date()): Promise<PartialSessionValidationResult> {
    return this.validate(token, userId, now);
  }

  async expire(token: string, now = new Date()): Promise<boolean> {
    const session = this.sessions.get(hashToken(token));
    if (!session || session.status !== 'ACTIVE') return false;
    session.status = 'EXPIRED';
    session.expiresAt = new Date(Math.min(session.expiresAt.getTime(), now.getTime()));
    return true;
  }

  async consume(token: string, now = new Date()): Promise<boolean> {
    const session = this.sessions.get(hashToken(token));
    if (!session) return false;
    const validation = await this.validate(token, session.userId, now);
    if (!validation.isValid) return false;
    session.status = 'CONSUMED';
    return true;
  }
}