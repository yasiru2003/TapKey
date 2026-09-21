import type {
  RateLimiterConfig,
  LockoutStatus,
  RateLimitKey,
  AuditLoggerInterface,
} from './types.js';

interface RateLimitRecord {
  consecutiveFailures: number;
  firstFailureTimestamp: number;
  lastFailureTimestamp: number;
  lockoutCount: number;
  lockedUntil?: number;
}

const DEFAULT_CONFIG: RateLimiterConfig = {
  maxFailures: 5,
  windowMs: 300000, // 5 minutes window
  baseLockoutMs: 60000, // 1 minute initial lockout
  maxLockoutMs: 3600000, // 1 hour max lockout
  enableExponentialBackoff: true,
};

/**
 * Design Choice D1 — Adaptive Rate Limiter & Lockout Engine
 * Enforces exponential backoff rate-limiting per username/userId and source IP address.
 */
export class RateLimiter {
  private config: RateLimiterConfig;
  private records: Map<string, RateLimitRecord> = new Map();
  private auditLogger?: AuditLoggerInterface;

  constructor(config?: Partial<RateLimiterConfig>, auditLogger?: AuditLoggerInterface) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.auditLogger = auditLogger;
  }

  /**
   * Generates cache lookup keys for a rate limit request.
   */
  private getKeys(key: RateLimitKey): string[] {
    const keys: string[] = [];
    if (key.userId) keys.push(`user:${key.userId}`);
    if (key.username) keys.push(`username:${key.username.toLowerCase()}`);
    if (key.ipAddress) keys.push(`ip:${key.ipAddress}`);
    return keys;
  }

  /**
   * Checks if a request key is currently locked out by rate limiting rules (Design D1).
   */
  public checkRateLimit(key: RateLimitKey): LockoutStatus {
    const now = Date.now();
    const lookupKeys = this.getKeys(key);

    for (const lookupKey of lookupKeys) {
      const record = this.records.get(lookupKey);
      if (record && record.lockedUntil && record.lockedUntil > now) {
        const remainingLockoutMs = record.lockedUntil - now;
        return {
          isLockedOut: true,
          remainingLockoutMs,
          consecutiveFailures: record.consecutiveFailures,
          reason: `[Design D1] Rate limit exceeded. Locked out for another ${Math.ceil(remainingLockoutMs / 1000)} seconds.`,
          lockedUntil: new Date(record.lockedUntil),
        };
      }
    }

    // Find highest consecutive failures across keys
    let maxFailures = 0;
    for (const lookupKey of lookupKeys) {
      const record = this.records.get(lookupKey);
      if (record) {
        // Clear expired window if needed
        if (now - record.lastFailureTimestamp > this.config.windowMs && (!record.lockedUntil || record.lockedUntil <= now)) {
          this.records.delete(lookupKey);
        } else {
          maxFailures = Math.max(maxFailures, record.consecutiveFailures);
        }
      }
    }

    return {
      isLockedOut: false,
      remainingLockoutMs: 0,
      consecutiveFailures: maxFailures,
    };
  }

  /**
   * Records a failed authentication attempt (Factor 1 or Factor 2).
   * Updates failure counts and calculates lockout / exponential backoff if threshold is reached.
   */
  public async recordFailedAttempt(key: RateLimitKey): Promise<LockoutStatus> {
    const now = Date.now();
    const lookupKeys = this.getKeys(key);
    let worstStatus: LockoutStatus = { isLockedOut: false, remainingLockoutMs: 0, consecutiveFailures: 0 };
    let lockoutTriggered = false;
    let lockoutDurationMs = 0;

    for (const lookupKey of lookupKeys) {
      let record = this.records.get(lookupKey);

      if (!record || (now - record.lastFailureTimestamp > this.config.windowMs && (!record.lockedUntil || record.lockedUntil <= now))) {
        record = {
          consecutiveFailures: 1,
          firstFailureTimestamp: now,
          lastFailureTimestamp: now,
          lockoutCount: 0,
        };
      } else {
        record.consecutiveFailures += 1;
        record.lastFailureTimestamp = now;
      }

      // Check if threshold reached
      if (record.consecutiveFailures >= this.config.maxFailures) {
        record.lockoutCount += 1;
        
        // Calculate exponential backoff lockout duration
        let lockoutMs = this.config.baseLockoutMs;
        if (this.config.enableExponentialBackoff && record.lockoutCount > 1) {
          lockoutMs = Math.min(
            this.config.baseLockoutMs * Math.pow(2, record.lockoutCount - 1),
            this.config.maxLockoutMs
          );
        }
        
        record.lockedUntil = now + lockoutMs;
        lockoutTriggered = true;
        lockoutDurationMs = Math.max(lockoutDurationMs, lockoutMs);
      }

      this.records.set(lookupKey, record);

      const status = this.checkRateLimit(key);
      if (status.isLockedOut || status.consecutiveFailures > worstStatus.consecutiveFailures) {
        worstStatus = status;
      }
    }

    // Log lockout event to audit logger once per attempt trigger
    if (lockoutTriggered && this.auditLogger) {
      await this.auditLogger.logAttempt({
        userId: key.userId || 'unknown',
        username: key.username,
        factor: 'SECURITY_RATE_LIMITER',
        ceremony: 'LOCKOUT_TRIGGERED',
        outcome: 'LOCKOUT',
        reason: `[Design D1] Threshold of ${this.config.maxFailures} failures hit. Lockout duration: ${lockoutDurationMs / 1000}s`,
        ipAddress: key.ipAddress,
        timestamp: new Date(now),
      }).catch(() => {});
    }

    return worstStatus;
  }

  /**
   * Resets rate limit failure counts upon successful multi-factor authentication.
   */
  public recordSuccess(key: RateLimitKey): void {
    const lookupKeys = this.getKeys(key);
    for (const lookupKey of lookupKeys) {
      this.records.delete(lookupKey);
    }
  }

  /**
   * Explicitly clears rate limiter state for specific keys.
   */
  public resetRateLimit(key: RateLimitKey): void {
    this.recordSuccess(key);
  }

  /**
   * Clears all active rate limit records across the system.
   */
  public clearAll(): void {
    this.records.clear();
  }
}

/** Default singleton instance of rate limiter */
export const defaultRateLimiter = new RateLimiter();
