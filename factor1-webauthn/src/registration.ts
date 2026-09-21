import {
  generateRegistrationOptions,
  verifyRegistrationResponse as verifyRegistrationResponseServer,
} from '@simplewebauthn/server';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  RegistrationResponseJSON,
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

export interface GenerateRegistrationOptionsParams {
  user: WebAuthnUser;
  sessionToken: string;
  gateValidator: SessionGateValidator;
  existingCredentials?: StoredWebAuthnCredential[];
  config: WebAuthnServerConfig;
  auditLogger?: AuditLogger;
  clientContext?: { ipAddress?: string; userAgent?: string };
  attestationType?: 'none' | 'indirect' | 'direct' | 'enterprise';
  authenticatorAttachment?: 'platform' | 'cross-platform';
  userVerification?: 'required' | 'preferred' | 'discouraged';
}

export interface VerifyRegistrationResponseParams {
  user: WebAuthnUser;
  response: RegistrationResponseJSON;
  expectedChallenge: string;
  sessionToken: string;
  gateValidator: SessionGateValidator;
  config: WebAuthnServerConfig;
  auditLogger?: AuditLogger;
  clientContext?: { ipAddress?: string; userAgent?: string };
  requireUserVerification?: boolean;
}

export interface RegistrationVerificationResult {
  verified: boolean;
  credential: StoredWebAuthnCredential;
}

/**
 * Generates WebAuthn registration options for a user to register a new platform authenticator.
 * Strictly enforces D2 session gate prior to generating options.
 */
export async function generateRegistrationChallenge(
  params: GenerateRegistrationOptionsParams
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const {
    user,
    sessionToken,
    gateValidator,
    existingCredentials = [],
    config,
    auditLogger,
    clientContext,
    attestationType = 'none',
    authenticatorAttachment = 'platform',
    userVerification = 'required',
  } = params;

  // D2 Gate Check: Must hold an active PartialAuthSession
  await assertSessionGateActive(
    sessionToken,
    user.id,
    gateValidator,
    auditLogger,
    'REGISTRATION',
    clientContext
  );

  const excludeCredentials = existingCredentials.map((cred) => ({
    id: cred.id,
    transports: cred.transports,
  }));

  const options = await generateRegistrationOptions({
    rpName: config.rpName,
    rpID: config.rpID,
    userID: Buffer.from(user.id, 'utf-8'),
    userName: user.username,
    userDisplayName: user.displayName || user.username,
    attestationType,
    excludeCredentials,
    authenticatorSelection: {
      authenticatorAttachment,
      userVerification,
      residentKey: 'preferred',
    },
    timeout: config.timeout || 60000,
  });

  return options;
}

/**
 * Verifies the WebAuthn registration response from the client's authenticator ceremony.
 * Strictly checks D2 session gate, verifies attestation, extracts public key, and logs to AuditLogger.
 */
export async function verifyRegistrationResponse(
  params: VerifyRegistrationResponseParams
): Promise<RegistrationVerificationResult> {
  const {
    user,
    response,
    expectedChallenge,
    sessionToken,
    gateValidator,
    config,
    auditLogger,
    clientContext,
    requireUserVerification = true,
  } = params;

  // D2 Gate Check
  await assertSessionGateActive(
    sessionToken,
    user.id,
    gateValidator,
    auditLogger,
    'REGISTRATION',
    clientContext
  );

  try {
    const verification = await verifyRegistrationResponseServer({
      response,
      expectedChallenge,
      expectedOrigin: config.origin,
      expectedRPID: config.rpID,
      requireUserVerification,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new WebAuthnVerificationError(
        'Registration verification returned false or missing registration info'
      );
    }

    const { credentialID, credentialPublicKey, counter, credentialBackedUp } = verification.registrationInfo;

    const storedCredential: StoredWebAuthnCredential = {
      id: credentialID,
      userId: user.id,
      publicKey: credentialPublicKey,
      signCount: counter,
      backedUp: credentialBackedUp,
      transports: response.response.transports,
      createdAt: new Date(),
      lastUsedAt: new Date(),
    };

    if (auditLogger) {
      await auditLogger.logAttempt({
        userId: user.id,
        factor: 'FACTOR_1_WEBAUTHN',
        ceremony: 'REGISTRATION',
        outcome: 'SUCCESS',
        signCount: counter,
        ipAddress: clientContext?.ipAddress,
        userAgent: clientContext?.userAgent,
        timestamp: new Date(),
      }).catch(() => {});
    }

    return {
      verified: true,
      credential: storedCredential,
    };
  } catch (error) {
    if (auditLogger) {
      await auditLogger.logAttempt({
        userId: user.id,
        factor: 'FACTOR_1_WEBAUTHN',
        ceremony: 'REGISTRATION',
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
      `WebAuthn registration verification failed: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }
}
