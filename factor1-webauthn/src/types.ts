import type {
  AuthenticatorTransportFuture,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/types';

/**
 * Represents a registered FIDO2 / WebAuthn public key credential stored in WebAuthnCredential table.
 */
export interface StoredWebAuthnCredential {
  /** Unique base64url encoded credential identifier */
  id: string;
  /** Internal unique user identifier */
  userId: string;
  /** Base64url or binary encoded public key bytes */
  publicKey: Uint8Array;
  /** Signature counter used to detect replay / cloned authenticator attacks */
  signCount: number;
  /** Backed up status (multi-device passkey) */
  backedUp?: boolean;
  /** Authenticator transports supported by this credential (e.g. ['internal', 'usb', 'nfc']) */
  transports?: AuthenticatorTransportFuture[];
  /** When this credential was enrolled */
  createdAt: Date;
  /** Last time this credential was successfully verified */
  lastUsedAt?: Date;
}

/**
 * User representation required for WebAuthn ceremonies.
 */
export interface WebAuthnUser {
  id: string;
  username: string;
  displayName?: string;
}

/**
 * Result returned upon verifying a PartialAuthSession token with Senadi's session module.
 */
export interface PartialSessionValidationResult {
  isValid: boolean;
  reason?: 'SESSION_NOT_FOUND' | 'SESSION_EXPIRED' | 'SESSION_USER_MISMATCH' | 'SESSION_ALREADY_USED' | string;
  expiresAt?: Date;
  userId?: string;
}

/**
 * Interface for Senadi's Session Manager to validate PartialAuthSession gate (Design D2).
 */
export interface SessionGateValidator {
  validatePartialSession(
    sessionToken: string,
    userId: string
  ): Promise<PartialSessionValidationResult>;
}

/**
 * Outcome event payload for Hasini's LoginAttempt security logging.
 */
export interface AuditLogEntry {
  userId: string;
  factor: 'FACTOR_1_WEBAUTHN';
  ceremony: 'REGISTRATION' | 'AUTHENTICATION';
  outcome: 'SUCCESS' | 'FAILURE' | 'BLOCKED_SESSION_GATE';
  reason?: string;
  signCount?: number;
  ipAddress?: string;
  userAgent?: string;
  timestamp?: Date;
}

/**
 * Interface for Hasini's Security Hardening & Audit Logging module.
 */
export interface AuditLogger {
  logAttempt(entry: AuditLogEntry): Promise<void>;
}

/**
 * Configuration options for the Relying Party (Server).
 */
export interface WebAuthnServerConfig {
  /** Relying Party human-readable name (e.g., 'TapKey Auth') */
  rpName: string;
  /** Relying Party ID (e.g., 'localhost' or 'tapkey.local') */
  rpID: string;
  /** Expected origin matching the client protocol, domain, and port */
  origin: string | string[];
  /** Challenge timeout in milliseconds (default: 60000ms) */
  timeout?: number;
}

/**
 * Specialized error thrown when Design D2 session gate check fails.
 */
export class SessionGateError extends Error {
  public readonly code = 'SESSION_GATE_REJECTED';
  constructor(
    public readonly reason: string,
    public readonly userId: string
  ) {
    super(`[Design D2] Factor 1 access rejected: PartialAuthSession invalid or missing (${reason}) for user ${userId}`);
    this.name = 'SessionGateError';
  }
}

/**
 * Specialized error thrown when WebAuthn cryptographic verification fails.
 */
export class WebAuthnVerificationError extends Error {
  public readonly code = 'WEBAUTHN_VERIFICATION_FAILED';
  constructor(
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'WebAuthnVerificationError';
  }
}

export type {
  AuthenticatorTransportFuture,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
};
