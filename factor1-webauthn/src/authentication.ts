import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse as verifyAuthenticationResponseServer,
} from '@simplewebauthn/server';
import type {
  PublicKeyCredentialRequestOptionsJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/types';
import { assertSessionGateActive } from './sessionGate.js';
import {
  type StoredWebAuthnCredential,
  type WebAuthnUser,
  type SessionGateValidator,
  type AuditLogger,
  type WebAuthnServerConfig,
  WebAuthnVerificationError,
} from './types.js';

export interface GenerateAuthenticationOptionsParams {
  user: WebAuthnUser;
  sessionToken: string;
  gateValidator: SessionGateValidator;
  userCredentials: StoredWebAuthnCredential[];
  config: WebAuthnServerConfig;
  auditLogger?: AuditLogger;
  clientContext?: { ipAddress?: string; userAgent?: string };
  userVerification?: 'required' | 'preferred' | 'discouraged';
}

export interface VerifyAuthenticationAssertionParams {
  user: WebAuthnUser;
  response: AuthenticationResponseJSON;
  expectedChallenge: string;
  storedCredential: StoredWebAuthnCredential;
  sessionToken: string;
  gateValidator: SessionGateValidator;
  config: WebAuthnServerConfig;
  auditLogger?: AuditLogger;
  clientContext?: { ipAddress?: string; userAgent?: string };
  requireUserVerification?: boolean;
}

export interface AuthenticationVerificationResult {
  verified: boolean;
  credentialId: string;
  updatedSignCount: number;
  newCounter: number;
}

/**
 * Generates WebAuthn authentication challenge options.
 * Strictly enforces D2 session gate before issuing challenge.
 */
export async function generateAuthenticationChallenge(
  params: GenerateAuthenticationOptionsParams
): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const {
    user,
    sessionToken,
    gateValidator,
    userCredentials,
    config,
    auditLogger,
    clientContext,
    userVerification = 'required',
  } = params;

  // D2 Gate Check: Must hold an active PartialAuthSession
  await assertSessionGateActive(
    sessionToken,
    user.id,
    gateValidator,
    auditLogger,
    'AUTHENTICATION',
    clientContext
  );

  if (!userCredentials || userCredentials.length === 0) {
    throw new WebAuthnVerificationError(
      `No registered WebAuthn credentials found for user ${user.username} (${user.id})`
    );
  }

  const allowCredentials = userCredentials.map((cred) => ({
    id: cred.id,
    transports: cred.transports,
  }));

  const options = await generateAuthenticationOptions({
    rpID: config.rpID,
    allowCredentials,
    userVerification,
    timeout: config.timeout || 60000,
  });

  return options;
}

/**
 * Verifies a signed WebAuthn assertion returned by the user's platform authenticator.
 * Strictly verifies D2 session gate, public key signature, and sign_count anti-replay invariants.
 */
export async function verifyAuthenticationAssertion(
  params: VerifyAuthenticationAssertionParams
): Promise<AuthenticationVerificationResult> {
  const {
    user,
    response,
    expectedChallenge,
    storedCredential,
    sessionToken,
    gateValidator,
    config,
    auditLogger,
    clientContext,
    requireUserVerification = true,
  } = params;

  // D2 Gate Check: Must hold an active PartialAuthSession
  await assertSessionGateActive(
    sessionToken,
    user.id,
    gateValidator,
    auditLogger,
    'AUTHENTICATION',
    clientContext
  );

  try {
    const verification = await verifyAuthenticationResponseServer({
      response,
      expectedChallenge,
      expectedOrigin: config.origin,
      expectedRPID: config.rpID,
      authenticator: {
        credentialID: storedCredential.id,
        credentialPublicKey: storedCredential.publicKey,
        counter: storedCredential.signCount,
        transports: storedCredential.transports,
      },
      requireUserVerification,
    });

    if (!verification.verified || !verification.authenticationInfo) {
      throw new WebAuthnVerificationError('WebAuthn assertion verification returned false');
    }

    const { newCounter } = verification.authenticationInfo;

    // Log successful attempt to Hasini's LoginAttempt table
    if (auditLogger) {
      await auditLogger.logAttempt({
        userId: user.id,
        factor: 'FACTOR_1_WEBAUTHN',
        ceremony: 'AUTHENTICATION',
        outcome: 'SUCCESS',
        signCount: newCounter,
        ipAddress: clientContext?.ipAddress,
        userAgent: clientContext?.userAgent,
        timestamp: new Date(),
      }).catch(() => {});
    }

    return {
      verified: true,
      credentialId: storedCredential.id,
      updatedSignCount: newCounter,
      newCounter,
    };
  } catch (error) {
    // Log failure attempt to Hasini's LoginAttempt table
    if (auditLogger) {
      await auditLogger.logAttempt({
        userId: user.id,
        factor: 'FACTOR_1_WEBAUTHN',
        ceremony: 'AUTHENTICATION',
        outcome: 'FAILURE',
        reason: error instanceof Error ? error.message : 'UNKNOWN_VERIFICATION_ERROR',
        ipAddress: clientContext?.ipAddress,
        userAgent: clientContext?.userAgent,
        timestamp: new Date(),
      }).catch(() => {});
    }

    if (error instanceof WebAuthnVerificationError) {
      throw error;
    }
    throw new WebAuthnVerificationError(
      `WebAuthn assertion verification failed: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }
}
