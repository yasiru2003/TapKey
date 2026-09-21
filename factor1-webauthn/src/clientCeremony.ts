import {
  startRegistration as startRegistrationBrowser,
  startAuthentication as startAuthenticationBrowser,
  browserSupportsWebAuthn as browserSupportsWebAuthnHelper,
  platformAuthenticatorIsAvailable as platformAuthenticatorIsAvailableHelper,
} from '@simplewebauthn/browser';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/types';

/**
 * Checks whether the client browser and environment supports the WebAuthn API.
 */
export function checkBrowserWebAuthnSupport(): boolean {
  return browserSupportsWebAuthnHelper();
}

/**
 * Checks whether a platform authenticator (e.g., TouchID, Windows Hello, FaceID) is available.
 */
export async function checkPlatformAuthenticatorAvailable(): Promise<boolean> {
  return await platformAuthenticatorIsAvailableHelper();
}

/**
 * Triggers the browser's native platform biometric ceremony for registering a new credential.
 * Wraps navigator.credentials.create() using @simplewebauthn/browser.
 *
 * @param options - Server-generated PublicKeyCredentialCreationOptionsJSON
 * @returns RegistrationResponseJSON ready to send back to server verifyRegistrationResponse
 */
export async function performClientRegistrationCeremony(
  options: PublicKeyCredentialCreationOptionsJSON
): Promise<RegistrationResponseJSON> {
  try {
    const response = await startRegistrationBrowser({
      optionsJSON: options,
    });
    return response;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'NotAllowedError') {
        throw new Error('Biometric registration was canceled or timed out by the user.');
      }
      if (error.name === 'InvalidStateError') {
        throw new Error('This authenticator is already registered for this account.');
      }
      throw new Error(`Platform biometric registration failed: ${error.message}`);
    }
    throw new Error('An unknown error occurred during platform registration ceremony.');
  }
}

/**
 * Triggers the browser's native platform biometric ceremony for authenticating.
 * Wraps navigator.credentials.get() using @simplewebauthn/browser.
 *
 * @param options - Server-generated PublicKeyCredentialRequestOptionsJSON
 * @returns AuthenticationResponseJSON ready to send back to server verifyAuthenticationAssertion
 */
export async function performClientAuthenticationCeremony(
  options: PublicKeyCredentialRequestOptionsJSON
): Promise<AuthenticationResponseJSON> {
  try {
    const response = await startAuthenticationBrowser({
      optionsJSON: options,
    });
    return response;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'NotAllowedError') {
        throw new Error('Biometric authentication was canceled or timed out by the user.');
      }
      throw new Error(`Platform biometric authentication failed: ${error.message}`);
    }
    throw new Error('An unknown error occurred during platform authentication ceremony.');
  }
}
