import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type {
  RecoveryTokenPayload,
  RecoveryResult,
  RecoveryReenrollmentHandlers,
  AuditLoggerInterface,
} from './types.js';

export interface GenerateRecoveryTokenParams {
  userId: string;
  email: string;
  secretKey: string;
  ttlMs?: number; // default: 15 minutes (900,000ms)
}

/**
 * Design Choice D6 — Out-of-Band Recovery Protocol
 * Handles identity recovery and factor re-enrollment when a user loses all Factor 1 biometric devices.
 * OPERATES ENTIRELY OUTSIDE PartialAuthSession — NEVER creates or reads partial sessions.
 */
export class RecoveryManager {
  private usedTokenIds: Set<string> = new Set();
  private auditLogger?: AuditLoggerInterface;

  constructor(auditLogger?: AuditLoggerInterface) {
    this.auditLogger = auditLogger;
  }

  /**
   * Generates a cryptographically signed HMAC-SHA256 out-of-band recovery magic token.
   */
  public generateRecoveryToken(params: GenerateRecoveryTokenParams): { token: string; payload: RecoveryTokenPayload } {
    const { userId, email, secretKey, ttlMs = 900000 } = params;
    const now = Date.now();
    const tokenId = randomBytes(16).toString('hex');

    const payload: RecoveryTokenPayload = {
      userId,
      email: email.toLowerCase(),
      tokenId,
      issuedAt: now,
      expiresAt: now + ttlMs,
      purpose: 'FACTOR_RESET_RECOVERY',
    };

    const payloadString = JSON.stringify(payload);
    const payloadBase64 = Buffer.from(payloadString).toString('base64url');
    
    const signature = createHmac('sha256', secretKey)
      .update(payloadBase64)
      .digest('base64url');

    const token = `${payloadBase64}.${signature}`;

    return { token, payload };
  }

  /**
   * Verifies an out-of-band recovery magic token signature, expiration, and single-use status.
   */
  public verifyRecoveryToken(token: string, secretKey: string): { isValid: boolean; payload?: RecoveryTokenPayload; reason?: string } {
    if (!token || typeof token !== 'string') {
      return { isValid: false, reason: 'INVALID_TOKEN_FORMAT' };
    }

    const parts = token.split('.');
    if (parts.length !== 2) {
      return { isValid: false, reason: 'MALFORMED_TOKEN_STRUCTURE' };
    }

    const [payloadBase64, providedSignature] = parts;

    // Verify HMAC signature using constant-time comparison
    const expectedSignature = createHmac('sha256', secretKey)
      .update(payloadBase64)
      .digest('base64url');

    const bufProvided = Buffer.from(providedSignature);
    const bufExpected = Buffer.from(expectedSignature);

    if (bufProvided.length !== bufExpected.length || !timingSafeEqual(bufProvided, bufExpected)) {
      return { isValid: false, reason: 'INVALID_HMAC_SIGNATURE' };
    }

    // Parse payload
    let payload: RecoveryTokenPayload;
    try {
      const payloadJson = Buffer.from(payloadBase64, 'base64url').toString('utf8');
      payload = JSON.parse(payloadJson);
    } catch {
      return { isValid: false, reason: 'INVALID_PAYLOAD_JSON' };
    }

    // Verify purpose
    if (payload.purpose !== 'FACTOR_RESET_RECOVERY') {
      return { isValid: false, reason: 'UNAUTHORIZED_TOKEN_PURPOSE' };
    }

    // Verify expiration
    const now = Date.now();
    if (now > payload.expiresAt) {
      return { isValid: false, reason: 'RECOVERY_TOKEN_EXPIRED' };
    }

    // Verify replay / single-use check
    if (this.usedTokenIds.has(payload.tokenId)) {
      return { isValid: false, reason: 'RECOVERY_TOKEN_ALREADY_USED' };
    }

    return { isValid: true, payload };
  }

  /**
   * Executes the full Design D6 Out-of-Band recovery protocol:
   * 1. Validates the recovery token.
   * 2. Marks the token as spent (anti-replay).
   * 3. Triggers forced reset / re-enrollment for Thashira's F2 and Yasiru's F1 modules.
   * 4. Logs event to Hasini's LoginAttempt audit log.
   */
  public async executeRecoveryReenrollment(
    token: string,
    secretKey: string,
    handlers: RecoveryReenrollmentHandlers,
    clientContext?: { ipAddress?: string; userAgent?: string }
  ): Promise<RecoveryResult> {
    const verification = this.verifyRecoveryToken(token, secretKey);

    if (!verification.isValid || !verification.payload) {
      if (this.auditLogger) {
        await this.auditLogger.logAttempt({
          userId: 'unknown',
          factor: 'SECURITY_RECOVERY',
          ceremony: 'RECOVERY',
          outcome: 'FAILURE',
          reason: `[Design D6] Recovery attempt failed: ${verification.reason}`,
          ipAddress: clientContext?.ipAddress,
          userAgent: clientContext?.userAgent,
          timestamp: new Date(),
        }).catch(() => {});
      }

      return {
        success: false,
        reason: verification.reason,
        reenrollmentRequired: {
          factor1WebAuthn: false,
          factor2Spacebar: false,
        },
      };
    }

    const { payload } = verification;

    // Mark token spent
    this.usedTokenIds.add(payload.tokenId);

    try {
      // Force both Thashira's (F2) and Yasiru's (F1) re-enrollment flows to run again from scratch
      await handlers.resetFactor2Secret(payload.userId);
      await handlers.resetFactor1Credentials(payload.userId);

      // Audit log successful recovery
      if (this.auditLogger) {
        await this.auditLogger.logAttempt({
          userId: payload.userId,
          factor: 'SECURITY_RECOVERY',
          ceremony: 'RECOVERY',
          outcome: 'SUCCESS',
          reason: '[Design D6] Out-of-band email recovery succeeded. Mandatory F1 & F2 re-enrollment triggered.',
          ipAddress: clientContext?.ipAddress,
          userAgent: clientContext?.userAgent,
          timestamp: new Date(),
        }).catch(() => {});
      }

      return {
        success: true,
        userId: payload.userId,
        email: payload.email,
        reenrollmentRequired: {
          factor1WebAuthn: true,
          factor2Spacebar: true,
        },
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      
      if (this.auditLogger) {
        await this.auditLogger.logAttempt({
          userId: payload.userId,
          factor: 'SECURITY_RECOVERY',
          ceremony: 'RECOVERY',
          outcome: 'FAILURE',
          reason: `[Design D6] Re-enrollment execution failed: ${errorMsg}`,
          ipAddress: clientContext?.ipAddress,
          userAgent: clientContext?.userAgent,
          timestamp: new Date(),
        }).catch(() => {});
      }

      return {
        success: false,
        userId: payload.userId,
        reason: `REENROLLMENT_EXECUTION_FAILED: ${errorMsg}`,
        reenrollmentRequired: {
          factor1WebAuthn: false,
          factor2Spacebar: false,
        },
      };
    }
  }

  /**
   * Clears expired or used token cache.
   */
  public clearUsedTokenCache(): void {
    this.usedTokenIds.clear();
  }
}

/** Default instance of recovery manager */
export const defaultRecoveryManager = new RecoveryManager();
