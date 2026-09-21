import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import type { CsrfOptions } from './types.js';

/**
 * Design Choice D7 — Strict Transport, CSRF & Security Hygiene Utilities
 */

/**
 * Performs constant-time string comparison to prevent timing attacks.
 */
export function secureCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');

  if (bufA.length !== bufB.length) {
    // Constant-time dummy comparison to prevent length leak timing vectors
    timingSafeEqual(bufA, bufA);
    return false;
  }

  return timingSafeEqual(bufA, bufB);
}

/**
 * Generates a cryptographically random hex/base64url string token.
 */
export function generateSecureToken(byteLength: number = 32, encoding: 'hex' | 'base64url' = 'base64url'): string {
  const bytes = randomBytes(byteLength);
  if (encoding === 'hex') {
    return bytes.toString('hex');
  }
  return bytes.toString('base64url');
}

/**
 * Generates a signed CSRF token with expiration timestamp (Design D7).
 */
export function generateCsrfToken(options: CsrfOptions): { token: string; expiresAt: number } {
  const { secretKey, tokenTtlMs = 3600000 } = options; // Default: 1 hour
  const now = Date.now();
  const expiresAt = now + tokenTtlMs;
  const nonce = randomBytes(16).toString('hex');

  const rawPayload = `${nonce}:${expiresAt}`;
  const signature = createHmac('sha256', secretKey)
    .update(rawPayload)
    .digest('base64url');

  const token = `${rawPayload}:${signature}`;
  return { token, expiresAt };
}

/**
 * Verifies a CSRF token signature and expiration timestamp (Design D7).
 */
export function verifyCsrfToken(token: string, secretKey: string): { isValid: boolean; reason?: string } {
  if (!token || typeof token !== 'string') {
    return { isValid: false, reason: 'MISSING_OR_INVALID_CSRF_TOKEN' };
  }

  const parts = token.split(':');
  if (parts.length !== 3) {
    return { isValid: false, reason: 'MALFORMED_CSRF_TOKEN_FORMAT' };
  }

  const [nonce, expiresAtStr, providedSignature] = parts;
  const expiresAt = parseInt(expiresAtStr, 10);

  if (isNaN(expiresAt)) {
    return { isValid: false, reason: 'INVALID_CSRF_EXPIRATION_TIMESTAMP' };
  }

  const now = Date.now();
  if (now > expiresAt) {
    return { isValid: false, reason: 'EXPIRED_CSRF_TOKEN' };
  }

  const rawPayload = `${nonce}:${expiresAtStr}`;
  const expectedSignature = createHmac('sha256', secretKey)
    .update(rawPayload)
    .digest('base64url');

  if (!secureCompare(providedSignature, expectedSignature)) {
    return { isValid: false, reason: 'INVALID_CSRF_SIGNATURE' };
  }

  return { isValid: true };
}

/**
 * Utility function to verify if incoming HTTP request is using HTTPS transport.
 */
export function isHttpsRequest(headers: Record<string, string | string[] | undefined>, socketEncrypted?: boolean): boolean {
  if (socketEncrypted === true) {
    return true;
  }

  const protoHeader = headers['x-forwarded-proto'];
  if (typeof protoHeader === 'string' && protoHeader.toLowerCase() === 'https') {
    return true;
  }
  if (Array.isArray(protoHeader) && protoHeader.length > 0 && protoHeader[0].toLowerCase() === 'https') {
    return true;
  }

  return false;
}

/**
 * Generates security headers recommended for TapKey HTTPS/session hygiene (Design D7).
 */
export function getRecommendedSecurityHeaders(): Record<string, string> {
  return {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '0',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; object-src 'none';",
  };
}

/**
 * Generates configuration for secure HTTP-only SameSite=Strict cookies (Design D7).
 */
export function getSecureCookieConfig(maxAgeSeconds: number = 300): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  maxAge: number;
  path: string;
} {
  return {
    httpOnly: true,
    secure: true, // Requires HTTPS
    sameSite: 'strict',
    maxAge: maxAgeSeconds,
    path: '/',
  };
}
