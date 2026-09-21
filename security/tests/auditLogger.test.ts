import { describe, it, expect, beforeEach } from 'vitest';
import { AuditLogger } from '../src/auditLogger.js';

describe('AuditLogger Module', () => {
  let logger: AuditLogger;

  beforeEach(() => {
    logger = new AuditLogger();
  });

  it('should log Factor 1 and Factor 2 attempts with default metadata', async () => {
    await logger.logAttempt({
      userId: 'user-123',
      username: 'alice',
      factor: 'FACTOR_2_SPACEBAR',
      ceremony: 'AUTHENTICATION',
      outcome: 'SUCCESS',
      timestamp: new Date(1000),
    });

    await logger.logAttempt({
      userId: 'user-123',
      username: 'alice',
      factor: 'FACTOR_1_WEBAUTHN',
      ceremony: 'AUTHENTICATION',
      outcome: 'SUCCESS',
      signCount: 42,
      timestamp: new Date(2000),
    });

    const logs = await logger.getLogs({ userId: 'user-123' });
    expect(logs).toHaveLength(2);
    expect(logs[0].factor).toBe('FACTOR_1_WEBAUTHN');
    expect(logs[0].signCount).toBe(42);
    expect(logs[1].factor).toBe('FACTOR_2_SPACEBAR');
  });

  it('should query logs by factor and outcome', async () => {
    await logger.logAttempt({
      userId: 'user-1',
      factor: 'FACTOR_2_SPACEBAR',
      outcome: 'FAILURE',
      reason: 'INVALID_TAP_PATTERN',
    });

    await logger.logAttempt({
      userId: 'user-2',
      factor: 'FACTOR_2_SPACEBAR',
      outcome: 'SUCCESS',
    });

    await logger.logAttempt({
      userId: 'user-1',
      factor: 'FACTOR_1_WEBAUTHN',
      outcome: 'FAILURE',
      reason: 'SESSION_GATE_REJECTED',
    });

    const f2Failures = await logger.getLogs({ factor: 'FACTOR_2_SPACEBAR', outcome: 'FAILURE' });
    expect(f2Failures).toHaveLength(1);
    expect(f2Failures[0].userId).toBe('user-1');

    const count = await logger.getFailedAttemptsCount({ userId: 'user-1' });
    expect(count).toBe(2);
  });

  it('should trigger real-time log event listeners', async () => {
    const events: string[] = [];
    logger.onLog((entry) => {
      events.push(`${entry.factor}:${entry.outcome}`);
    });

    await logger.logAttempt({
      userId: 'user-3',
      factor: 'FACTOR_2_SPACEBAR',
      outcome: 'SUCCESS',
    });

    expect(events).toEqual(['FACTOR_2_SPACEBAR:SUCCESS']);
  });
});
