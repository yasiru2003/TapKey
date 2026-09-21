/**
 * Audit Log Entry representing an authentication attempt for Factor 1 or Factor 2.
 */
export interface AuditLogEntry {
  /** Optional unique identifier for the log entry */
  id?: string;
  /** Internal unique user identifier */
  userId: string;
  /** Username associated with the attempt */
  username?: string;
  /** Which factor was being evaluated */
  factor: 'FACTOR_1_WEBAUTHN' | 'FACTOR_2_SPACEBAR' | string;
  /** The ceremony or operation type */
  ceremony?: 'REGISTRATION' | 'AUTHENTICATION' | 'RECOVERY' | 'TACTILE_CHECK' | string;
  /** The result outcome of the attempt */
  outcome: 'SUCCESS' | 'FAILURE' | 'BLOCKED_SESSION_GATE' | 'LOCKOUT' | string;
  /** Detailed reason in case of failure or lockout */
  reason?: string;
  /** WebAuthn signature count if applicable */
  signCount?: number;
  /** IP address of the client request */
  ipAddress?: string;
  /** User-Agent string of the client request */
  userAgent?: string;
  /** Timestamp when the event occurred */
  timestamp?: Date;
}

/**
 * Filter options when querying audit log records.
 */
export interface AuditQueryFilter {
  userId?: string;
  username?: string;
  factor?: string;
  outcome?: string;
  ipAddress?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

/**
 * Interface for Audit Logger implementation.
 */
export interface AuditLoggerInterface {
  logAttempt(entry: AuditLogEntry): Promise<void>;
  getLogs(filter?: AuditQueryFilter): Promise<AuditLogEntry[]>;
  clearLogs(): Promise<void>;
}

/**
 * Configuration options for Design D1 Adaptive Rate Limiting.
 */
export interface RateLimiterConfig {
  /** Number of consecutive allowed failures before triggering lockout (default: 5) */
  maxFailures: number;
  /** Time window in milliseconds to track consecutive failures (default: 300,000ms = 5 mins) */
  windowMs: number;
  /** Initial base lockout duration in milliseconds (default: 60,000ms = 1 min) */
  baseLockoutMs: number;
  /** Maximum cap for lockout duration in milliseconds (default: 3,600,000ms = 1 hr) */
  maxLockoutMs: number;
  /** Whether to double lockout duration on subsequent lockouts (exponential backoff) */
  enableExponentialBackoff: boolean;
}

/**
 * Lockout status result returned by rate limiter check.
 */
export interface LockoutStatus {
  /** Whether account or IP is currently locked out */
  isLockedOut: boolean;
  /** Time remaining in lockout state in milliseconds */
  remainingLockoutMs: number;
  /** Current count of consecutive failed attempts */
  consecutiveFailures: number;
  /** Human readable explanation of lockout status */
  reason?: string;
  /** Exact date/time when lockout expires */
  lockedUntil?: Date;
}

/**
 * Identification key for rate limiting (username/userId and/or IP address).
 */
export interface RateLimitKey {
  userId?: string;
  username?: string;
  ipAddress?: string;
}

/**
 * Payload contained in cryptographically signed Out-of-Band Recovery Magic Tokens (Design D6).
 */
export interface RecoveryTokenPayload {
  userId: string;
  email: string;
  tokenId: string;
  issuedAt: number;
  expiresAt: number;
  purpose: 'FACTOR_RESET_RECOVERY';
}

/**
 * Result returned upon executing Out-of-Band Recovery flow.
 */
export interface RecoveryResult {
  success: boolean;
  userId?: string;
  email?: string;
  reason?: string;
  reenrollmentRequired: {
    factor1WebAuthn: boolean;
    factor2Spacebar: boolean;
  };
}

/**
 * Callbacks supplied to recovery handler to trigger re-enrollment logic in F1 & F2.
 */
export interface RecoveryReenrollmentHandlers {
  resetFactor1Credentials(userId: string): Promise<void>;
  resetFactor2Secret(userId: string): Promise<void>;
}

/**
 * Options for CSRF token generation and validation (Design D7).
 */
export interface CsrfOptions {
  secretKey: string;
  tokenTtlMs?: number;
}
