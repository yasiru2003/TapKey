/**
 * @file index.ts
 * @module @tapkey/factor1-webauthn
 * @description Factor 1 (WebAuthn / FIDO2) Biometric Authentication & D2 Session Gate Module for TapKey
 * @author Yasiru (230076R)
 */

// Types & Errors
export * from './types.js';

// D2 Session Gate
export { assertSessionGateActive } from './sessionGate.js';

// Server-side Registration
export {
  generateRegistrationChallenge,
  verifyRegistrationResponse,
  type GenerateRegistrationOptionsParams,
  type VerifyRegistrationResponseParams,
  type RegistrationVerificationResult,
} from './registration.js';

// Server-side Authentication
export {
  generateAuthenticationChallenge,
  verifyAuthenticationAssertion,
  type GenerateAuthenticationOptionsParams,
  type VerifyAuthenticationAssertionParams,
  type AuthenticationVerificationResult,
} from './authentication.js';

// Client-side Browser Ceremonies
export {
  checkBrowserWebAuthnSupport,
  checkPlatformAuthenticatorAvailable,
  performClientRegistrationCeremony,
  performClientAuthenticationCeremony,
} from './clientCeremony.js';
