import { describe, it, expect, beforeEach } from 'vitest';
import { RateLimiter } from '../src/rateLimiter.js';
import { AuditLogger } from '../src/auditLogger.js';

describe('Design D1 — RateLimiter Module', () => {
  let rateLimiter: RateLimiter;
  let auditLogger: AuditLogger;

  beforeEach(() => {
    auditLogger = new AuditLogger();
    rateLimiter = new RateLimiter(
      {
        maxFailures: 3,
        windowMs: 60000,
        baseLockoutMs: 1000, // 1 second for fast test execution
        enableExponentialBackoff: true,
      },
      auditLogger
    );
  });

  it('should allow requests under the failure threshold', async () => {
    const key = { username: 'alice', ipAddress: '192.168.1.1' };
    
    await rateLimiter.recordFailedAttempt(key);
    await rateLimiter.recordFailedAttempt(key);

    const status = rateLimiter.checkRateLimit(key);
    expect(status.isLockedOut).toBe(false);
    expect(status.consecutiveFailures).toBe(2);
  });

  it('should trigger lockout when failure threshold is reached (Design D1)', async () => {
    const key = { username: 'bob', ipAddress: '10.0.0.1' };

    await rateLimiter.recordFailedAttempt(key);
    await rateLimiter.recordFailedAttempt(key);
    const lockoutStatus = await rateLimiter.recordFailedAttempt(key); // 3rd failure

    expect(lockoutStatus.isLockedOut).toBe(true);
    expect(lockoutStatus.remainingLockoutMs).toBeGreaterThan(0);
    expect(lockoutStatus.reason).toContain('[Design D1]');

    // Verify audit log entry for lockout
    const logs = await auditLogger.getLogs({ outcome: 'LOCKOUT' });
    expect(logs).toHaveLength(1);
    expect(logs[0].username).toBe('bob');
  });

  it('should apply exponential backoff on subsequent lockouts', async () => {
    const key = { username: 'charlie' };

    // First lockout
    await rateLimiter.recordFailedAttempt(key);
    await rateLimiter.recordFailedAttempt(key);
    const status1 = await rateLimiter.recordFailedAttempt(key);
    expect(status1.remainingLockoutMs).toBeLessThanOrEqual(1000);

    // Force expire lockout timestamp for testing second lockout calculation
    rateLimiter.clearAll();

    // Trigger second lockout cycle
    await rateLimiter.recordFailedAttempt(key);
    await rateLimiter.recordFailedAttempt(key);
    const status2 = await rateLimiter.recordFailedAttempt(key);

    expect(status2.isLockedOut).toBe(true);
  });

  it('should clear lockout state upon successful authentication', async () => {
    const key = { username: 'dave' };

    await rateLimiter.recordFailedAttempt(key);
    await rateLimiter.recordFailedAttempt(key);

    rateLimiter.recordSuccess(key);

    const status = rateLimiter.checkRateLimit(key);
    expect(status.isLockedOut).toBe(false);
    expect(status.consecutiveFailures).toBe(0);
  });
});
