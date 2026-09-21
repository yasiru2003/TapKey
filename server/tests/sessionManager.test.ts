import { describe, expect, it } from 'vitest';
import { InMemoryPartialAuthSessionStore, PARTIAL_SESSION_TTL_MS } from '../src/sessionManager.js';

describe('PartialAuthSession lifecycle', () => {
  it('creates a five-minute session and validates it for its user', async () => {
    const store = new InMemoryPartialAuthSessionStore();
    const now = new Date('2026-01-01T00:00:00.000Z');
    const created = await store.create('user-1', now);

    expect(created.session.expiresAt.getTime() - now.getTime()).toBe(PARTIAL_SESSION_TTL_MS);
    expect(await store.validate(created.token, 'user-1', now)).toMatchObject({ isValid: true, userId: 'user-1' });
    expect(await store.validatePartialSession(created.token, 'user-1', now)).toMatchObject({ isValid: true });
  });

  it('rejects a different user and expires at the TTL boundary', async () => {
    const store = new InMemoryPartialAuthSessionStore();
    const now = new Date('2026-01-01T00:00:00.000Z');
    const created = await store.create('user-1', now);

    expect((await store.validate(created.token, 'user-2', now)).reason).toBe('SESSION_USER_MISMATCH');
    expect((await store.validate(created.token, 'user-1', new Date(now.getTime() + PARTIAL_SESSION_TTL_MS))).reason).toBe('SESSION_EXPIRED');
  });

  it('can explicitly expire and consume a session', async () => {
    const store = new InMemoryPartialAuthSessionStore();
    const created = await store.create('user-1');

    expect(await store.consume(created.token)).toBe(true);
    expect((await store.validate(created.token, 'user-1')).reason).toBe('SESSION_ALREADY_USED');
    expect(await store.expire(created.token)).toBe(false);
  });
});