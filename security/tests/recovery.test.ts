import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RecoveryManager } from '../src/recovery.js';
import { AuditLogger } from '../src/auditLogger.js';

describe('Design D6 — RecoveryManager Module', () => {
  let recoveryManager: RecoveryManager;
  let auditLogger: AuditLogger;
  const SECRET_KEY = 'super-secret-recovery-signing-key';

  beforeEach(() => {
    auditLogger = new AuditLogger();
    recoveryManager = new RecoveryManager(auditLogger);
  });

  it('should generate and verify a valid out-of-band recovery token', () => {
    const { token, payload } = recoveryManager.generateRecoveryToken({
      userId: 'user-777',
      email: 'user@example.com',
      secretKey: SECRET_KEY,
    });

    expect(token).toBeDefined();
    expect(payload.userId).toBe('user-777');
    expect(payload.email).toBe('user@example.com');

    const verifyResult = recoveryManager.verifyRecoveryToken(token, SECRET_KEY);
    expect(verifyResult.isValid).toBe(true);
    expect(verifyResult.payload?.userId).toBe('user-777');
  });

  it('should reject a recovery token with an invalid HMAC signature', () => {
    const { token } = recoveryManager.generateRecoveryToken({
      userId: 'user-777',
      email: 'user@example.com',
      secretKey: SECRET_KEY,
    });

    const verifyResult = recoveryManager.verifyRecoveryToken(token, 'wrong-secret-key');
    expect(verifyResult.isValid).toBe(false);
    expect(verifyResult.reason).toBe('INVALID_HMAC_SIGNATURE');
  });

  it('should execute full D6 recovery re-enrollment flow and reset both factors', async () => {
    const { token } = recoveryManager.generateRecoveryToken({
      userId: 'user-777',
      email: 'user@example.com',
      secretKey: SECRET_KEY,
    });

    const resetF1 = vi.fn().mockResolvedValue(undefined);
    const resetF2 = vi.fn().mockResolvedValue(undefined);

    const result = await recoveryManager.executeRecoveryReenrollment(
      token,
      SECRET_KEY,
      {
        resetFactor1Credentials: resetF1,
        resetFactor2Secret: resetF2,
      },
      { ipAddress: '10.1.2.3' }
    );

    expect(result.success).toBe(true);
    expect(result.userId).toBe('user-777');
    expect(result.reenrollmentRequired.factor1WebAuthn).toBe(true);
    expect(result.reenrollmentRequired.factor2Spacebar).toBe(true);

    expect(resetF1).toHaveBeenCalledWith('user-777');
    expect(resetF2).toHaveBeenCalledWith('user-777');

    // Audit log entry verify
    const logs = await auditLogger.getLogs({ factor: 'SECURITY_RECOVERY' });
    expect(logs).toHaveLength(1);
    expect(logs[0].outcome).toBe('SUCCESS');
  });

  it('should prevent replay attacks by rejecting reused recovery tokens', async () => {
    const { token } = recoveryManager.generateRecoveryToken({
      userId: 'user-777',
      email: 'user@example.com',
      secretKey: SECRET_KEY,
    });

    const handlers = {
      resetFactor1Credentials: vi.fn(),
      resetFactor2Secret: vi.fn(),
    };

    const firstRun = await recoveryManager.executeRecoveryReenrollment(token, SECRET_KEY, handlers);
    expect(firstRun.success).toBe(true);

    const secondRun = await recoveryManager.executeRecoveryReenrollment(token, SECRET_KEY, handlers);
    expect(secondRun.success).toBe(false);
    expect(secondRun.reason).toBe('RECOVERY_TOKEN_ALREADY_USED');
  });
});
