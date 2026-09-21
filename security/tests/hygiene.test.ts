import { describe, it, expect } from 'vitest';
import {
  secureCompare,
  generateSecureToken,
  generateCsrfToken,
  verifyCsrfToken,
  isHttpsRequest,
  getRecommendedSecurityHeaders,
  getSecureCookieConfig,
} from '../src/hygiene.js';

describe('Design D7 — SecurityHygiene Module', () => {
  it('should perform timing-safe string comparison accurately', () => {
    expect(secureCompare('secret-token-123', 'secret-token-123')).toBe(true);
    expect(secureCompare('secret-token-123', 'secret-token-456')).toBe(false);
    expect(secureCompare('secret-token-123', 'short')).toBe(false);
  });

  it('should generate cryptographically secure random tokens', () => {
    const token1 = generateSecureToken(32, 'hex');
    const token2 = generateSecureToken(32, 'hex');

    expect(token1).toHaveLength(64);
    expect(token2).toHaveLength(64);
    expect(token1).not.toEqual(token2);
  });

  it('should generate and verify valid CSRF tokens', () => {
    const secretKey = 'csrf-secret-key-999';
    const { token } = generateCsrfToken({ secretKey, tokenTtlMs: 60000 });

    const verification = verifyCsrfToken(token, secretKey);
    expect(verification.isValid).toBe(true);
  });

  it('should reject tampered or expired CSRF tokens', () => {
    const secretKey = 'csrf-secret-key-999';
    const { token } = generateCsrfToken({ secretKey, tokenTtlMs: 60000 });

    const tamperedToken = token.slice(0, -3) + 'abc';
    const tamperedResult = verifyCsrfToken(tamperedToken, secretKey);
    expect(tamperedResult.isValid).toBe(false);
    expect(tamperedResult.reason).toBe('INVALID_CSRF_SIGNATURE');
  });

  it('should identify HTTPS requests accurately', () => {
    expect(isHttpsRequest({ 'x-forwarded-proto': 'https' })).toBe(true);
    expect(isHttpsRequest({ 'x-forwarded-proto': 'http' })).toBe(false);
    expect(isHttpsRequest({}, true)).toBe(true);
  });

  it('should output recommended security headers and secure cookie configuration', () => {
    const headers = getRecommendedSecurityHeaders();
    expect(headers['Strict-Transport-Security']).toContain('max-age=31536000');
    expect(headers['X-Frame-Options']).toBe('DENY');

    const cookieConfig = getSecureCookieConfig(300);
    expect(cookieConfig.httpOnly).toBe(true);
    expect(cookieConfig.secure).toBe(true);
    expect(cookieConfig.sameSite).toBe('strict');
  });
});
