import { describe, it, expect, vi } from 'vitest';
import { generateRegistrationChallenge, verifyRegistrationResponse } from '../src/registration.js';
import { generateAuthenticationChallenge, verifyAuthenticationAssertion } from '../src/authentication.js';
import {
  type StoredWebAuthnCredential,
  type WebAuthnUser,
  type SessionGateValidator,
  type AuditLogger,
  type WebAuthnServerConfig,
  SessionGateError,
  WebAuthnVerificationError,
} from '../src/types.js';

describe('Factor 1: WebAuthn Challenge Generation & Verification', () => {
  const mockUser: WebAuthnUser = {
    id: 'usr_abc123',
    username: 'yasiru_test',
    displayName: 'Yasiru Test',
  };

  const mockConfig: WebAuthnServerConfig = {
    rpName: 'TapKey Auth',
    rpID: 'localhost',
    origin: 'http://localhost:3000',
    timeout: 60000,
  };

  const validSessionToken = 'part_sess_12345';

  const mockGateValidator: SessionGateValidator = {
    validatePartialSession: vi.fn().mockResolvedValue({
      isValid: true,
      userId: mockUser.id,
      expiresAt: new Date(Date.now() + 300000),
    }),
  };

  const mockInvalidGateValidator: SessionGateValidator = {
    validatePartialSession: vi.fn().mockResolvedValue({
      isValid: false,
      reason: 'SESSION_EXPIRED',
    }),
  };

  describe('Registration Challenge', () => {
    it('generates valid registration options with D2 session gate check', async () => {
      const options = await generateRegistrationChallenge({
        user: mockUser,
        sessionToken: validSessionToken,
        gateValidator: mockGateValidator,
        config: mockConfig,
      });

      expect(options).toBeDefined();
      expect(options.challenge).toBeTypeOf('string');
      expect(options.rp.name).toBe('TapKey Auth');
      expect(options.rp.id).toBe('localhost');
      expect(options.user.name).toBe('yasiru_test');
      expect(options.authenticatorSelection?.authenticatorAttachment).toBe('platform');
      expect(options.authenticatorSelection?.userVerification).toBe('required');
    });

    it('blocks registration options generation if session gate is invalid (D2 violation)', async () => {
      await expect(
        generateRegistrationChallenge({
          user: mockUser,
          sessionToken: validSessionToken,
          gateValidator: mockInvalidGateValidator,
          config: mockConfig,
        })
      ).rejects.toThrow(SessionGateError);
    });
  });

  describe('Authentication Challenge', () => {
    const mockStoredCredentials: StoredWebAuthnCredential[] = [
      {
        id: 'cred_id_base64url_123',
        userId: mockUser.id,
        publicKey: new Uint8Array([1, 2, 3, 4, 5]),
        signCount: 0,
        transports: ['internal'],
        createdAt: new Date(),
      },
    ];

    it('generates valid authentication options with D2 session gate check', async () => {
      const options = await generateAuthenticationChallenge({
        user: mockUser,
        sessionToken: validSessionToken,
        gateValidator: mockGateValidator,
        userCredentials: mockStoredCredentials,
        config: mockConfig,
      });

      expect(options).toBeDefined();
      expect(options.challenge).toBeTypeOf('string');
      expect(options.rpId).toBe('localhost');
      expect(options.allowCredentials).toHaveLength(1);
      expect(options.allowCredentials?.[0]?.id).toBe('cred_id_base64url_123');
    });

    it('rejects authentication challenge if user has no registered credentials', async () => {
      await expect(
        generateAuthenticationChallenge({
          user: mockUser,
          sessionToken: validSessionToken,
          gateValidator: mockGateValidator,
          userCredentials: [],
          config: mockConfig,
        })
      ).rejects.toThrow(WebAuthnVerificationError);
    });

    it('rejects authentication challenge if session gate is missing (D2 violation)', async () => {
      await expect(
        generateAuthenticationChallenge({
          user: mockUser,
          sessionToken: '',
          gateValidator: mockGateValidator,
          userCredentials: mockStoredCredentials,
          config: mockConfig,
        })
      ).rejects.toThrow(SessionGateError);
    });
  });

  describe('Audit Logging on Assertion Failure', () => {
    it('dispatches FAILURE audit log when assertion verification fails', async () => {
      const mockAuditLogger: AuditLogger = {
        logAttempt: vi.fn().mockResolvedValue(undefined),
      };

      const mockCredential: StoredWebAuthnCredential = {
        id: 'mock_cred_id',
        userId: mockUser.id,
        publicKey: new Uint8Array([10, 20, 30]),
        signCount: 1,
        createdAt: new Date(),
      };

      // Pass an invalid assertion payload to trigger cryptographic failure
      const malformedResponse = {
        id: 'mock_cred_id',
        rawId: 'mock_cred_id',
        response: {
          authenticatorData: 'invalid_auth_data',
          clientDataJSON: Buffer.from(JSON.stringify({
            type: 'webauthn.get',
            challenge: 'test_challenge',
            origin: 'http://localhost:3000',
          })).toString('base64url'),
          signature: 'invalid_sig',
        },
        type: 'public-key' as const,
        clientExtensionResults: {},
      };

      await expect(
        verifyAuthenticationAssertion({
          user: mockUser,
          response: malformedResponse,
          expectedChallenge: 'test_challenge',
          storedCredential: mockCredential,
          sessionToken: validSessionToken,
          gateValidator: mockGateValidator,
          config: mockConfig,
          auditLogger: mockAuditLogger,
        })
      ).rejects.toThrow(WebAuthnVerificationError);

      expect(mockAuditLogger.logAttempt).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          factor: 'FACTOR_1_WEBAUTHN',
          ceremony: 'AUTHENTICATION',
          outcome: 'FAILURE',
        })
      );
    });
  });
});
