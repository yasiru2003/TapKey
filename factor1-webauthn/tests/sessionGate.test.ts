import { describe, it, expect, vi } from 'vitest';
import { assertSessionGateActive } from '../src/sessionGate.js';
import {
  SessionGateError,
  type SessionGateValidator,
  type AuditLogger,
  type AuditLogEntry,
} from '../src/types.js';

describe('Design D2: PartialAuthSession Gate Verification', () => {
  const mockUserId = 'user_12345';
  const validToken = 'partial_sess_valid_abc123';

  it('should pass without error when session is valid and active', async () => {
    const mockValidator: SessionGateValidator = {
      validatePartialSession: vi.fn().mockResolvedValue({
        isValid: true,
        userId: mockUserId,
        expiresAt: new Date(Date.now() + 300000), // 5 minutes in future
      }),
    };

    await expect(
      assertSessionGateActive(validToken, mockUserId, mockValidator)
    ).resolves.toBeUndefined();

    expect(mockValidator.validatePartialSession).toHaveBeenCalledWith(validToken, mockUserId);
  });

  it('should reject immediately if sessionToken is missing or empty', async () => {
    const mockValidator: SessionGateValidator = {
      validatePartialSession: vi.fn(),
    };
    const mockAuditLogger: AuditLogger = {
      logAttempt: vi.fn().mockResolvedValue(undefined),
    };

    await expect(
      assertSessionGateActive('', mockUserId, mockValidator, mockAuditLogger)
    ).rejects.toThrow(SessionGateError);

    expect(mockValidator.validatePartialSession).not.toHaveBeenCalled();
    expect(mockAuditLogger.logAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: mockUserId,
        factor: 'FACTOR_1_WEBAUTHN',
        outcome: 'BLOCKED_SESSION_GATE',
        reason: 'MISSING_SESSION_TOKEN',
      })
    );
  });

  it('should reject and log if session is expired', async () => {
    const mockValidator: SessionGateValidator = {
      validatePartialSession: vi.fn().mockResolvedValue({
        isValid: false,
        reason: 'SESSION_EXPIRED',
        userId: mockUserId,
      }),
    };
    const mockAuditLogger: AuditLogger = {
      logAttempt: vi.fn().mockResolvedValue(undefined),
    };

    await expect(
      assertSessionGateActive('expired_token_123', mockUserId, mockValidator, mockAuditLogger)
    ).rejects.toThrow(SessionGateError);

    expect(mockAuditLogger.logAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: mockUserId,
        outcome: 'BLOCKED_SESSION_GATE',
        reason: 'SESSION_EXPIRED',
      })
    );
  });

  it('should reject if session belongs to a different user (user mismatch)', async () => {
    const mockValidator: SessionGateValidator = {
      validatePartialSession: vi.fn().mockResolvedValue({
        isValid: false,
        reason: 'SESSION_USER_MISMATCH',
      }),
    };

    await expect(
      assertSessionGateActive('valid_token_for_other_user', mockUserId, mockValidator)
    ).rejects.toThrowError(SessionGateError);
  });
});
