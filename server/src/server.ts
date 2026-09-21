import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import { db } from './db.js';

// Factor 1 WebAuthn imports
import {
  generateRegistrationChallenge,
  verifyRegistrationResponse,
  generateAuthenticationChallenge,
  verifyAuthenticationAssertion,
} from '../../factor1-webauthn/src/index.js';
import {
  SessionGateError,
  type StoredWebAuthnCredential,
  type WebAuthnUser,
  type SessionGateValidator,
  type AuditLogger,
  type AuditLogEntry,
  type WebAuthnServerConfig,
} from '../../factor1-webauthn/src/types.js';

// Factor 2 Spacebar imports
import {
  canonicalizeShiftedPin,
  hashPattern,
} from '../../factor2-spacebar/src/index.js';
import argon2 from 'argon2';

// Security imports
import { RateLimiter } from '../../security/src/rateLimiter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');

const PORT = Number(process.env.PORT) || 8095;
const RP_ID = 'localhost';
const EXPECTED_ORIGIN = `http://localhost:${PORT}`;

const config: WebAuthnServerConfig = {
  rpName: 'TapKey Accessible 2FA Protocol',
  rpID: RP_ID,
  origin: EXPECTED_ORIGIN,
  timeout: 60000,
};

// Rate limiter instance (Design D1)
const rateLimiter = new RateLimiter({
  maxFailures: 3,
  baseLockoutMs: 15000,
  maxLockoutMs: 300000,
  enableExponentialBackoff: true,
});

// Ephemeral challenge cache for ongoing ceremonies (challenge id -> challenge string)
const challengeCache = new Map<string, string>();

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Session Gate Validator (Design D2) adapting SQLite database
const sqliteSessionGateValidator: SessionGateValidator = {
  async validatePartialSession(sessionToken: string, userId: string) {
    if (!sessionToken || !userId) {
      return { isValid: false, reason: 'SESSION_NOT_FOUND' };
    }
    const tokenHash = hashToken(sessionToken);
    const row = db.findPartialSessionByTokenHash(tokenHash);
    if (!row) {
      return { isValid: false, reason: 'SESSION_NOT_FOUND' };
    }
    if (row.user_id !== userId) {
      return { isValid: false, reason: 'SESSION_USER_MISMATCH', userId: row.user_id };
    }
    if (row.status === 'CONSUMED') {
      return { isValid: false, reason: 'SESSION_ALREADY_USED', userId: row.user_id };
    }
    if (row.status === 'EXPIRED' || Date.now() >= row.expires_at) {
      db.updatePartialSessionStatus(tokenHash, 'EXPIRED');
      return { isValid: false, reason: 'SESSION_EXPIRED', expiresAt: new Date(row.expires_at), userId: row.user_id };
    }
    return { isValid: true, userId: row.user_id, expiresAt: new Date(row.expires_at) };
  },
};

// Audit Logger (Design Hasini) adapting SQLite database
const sqliteAuditLogger: AuditLogger = {
  async logAttempt(entry: AuditLogEntry) {
    const id = `log_${Date.now()}_${randomBytes(4).toString('hex')}`;
    db.logAttempt({
      id,
      userId: entry.userId,
      factor: entry.factor,
      ceremony: entry.ceremony,
      outcome: entry.outcome,
      reason: entry.reason,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
    });
    console.log(`[AUDIT] ${entry.factor} | ${entry.ceremony || 'AUTH'} | ${entry.outcome} | ${entry.reason || 'SUCCESS'}`);
  },
};

// Helper to parse JSON request bodies
function parseBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// JSON response helper
function sendJSON(res: http.ServerResponse, statusCode: number, data: any, headers: Record<string, string> = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...headers,
  });
  res.end(JSON.stringify(data, null, 2));
}

// Extract bearer token or cookie
function getSessionToken(req: http.IncomingMessage): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookie = req.headers.cookie;
  if (cookie) {
    const match = cookie.match(/tapkey_session=([^;]+)/);
    if (match) return match[1];
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || 'unknown';

  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return;
  }

  try {
    // Static asset serving
    if (req.method === 'GET' && !pathname.startsWith('/api/')) {
      let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
      if (!fs.existsSync(filePath)) {
        filePath = path.join(PUBLIC_DIR, 'index.html');
      }

      if (fs.existsSync(filePath)) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes: Record<string, string> = {
          '.html': 'text/html; charset=utf-8',
          '.js': 'text/javascript; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.json': 'application/json; charset=utf-8',
          '.png': 'image/png',
          '.svg': 'image/svg+xml',
        };
        res.writeHead(200, {
          'Content-Type': mimeTypes[ext] || 'text/plain',
          'Cache-Control': 'no-cache',
        });
        res.end(fs.readFileSync(filePath));
        return;
      }
    }

    // Registration Endpoints
    // Step 1: Start Registration (Claim Identity)
    if (req.method === 'POST' && pathname === '/api/register/start') {
      const body = await parseBody(req);
      const username = String(body.username || '').toLowerCase().trim();
      const displayName = String(body.displayName || username).trim();

      if (!username || username.length < 3) {
        return sendJSON(res, 400, { success: false, error: 'Username must be at least 3 characters long.' });
      }

      const existing = db.findUserByUsername(username);
      if (existing) {
        return sendJSON(res, 409, { success: false, error: 'Username is already registered. Please choose another.' });
      }

      const userId = `usr_${randomBytes(8).toString('hex')}`;
      const user = db.createUser(userId, username, displayName);

      return sendJSON(res, 200, {
        success: true,
        user: { id: user.id, username: user.username, displayName: user.display_name },
        next: 'FACTOR_2_SETUP',
      });
    }

    // Step 2: Enroll Factor 2 Spacebar Secret
    if (req.method === 'POST' && pathname === '/api/register/factor2') {
      const body = await parseBody(req);
      const userId = String(body.userId || '').trim();
      const candidate = body.candidate;

      if (!userId || !candidate || !Array.isArray(candidate.tapCounts) || candidate.tapCounts.length !== 4) {
        return sendJSON(res, 400, { success: false, error: 'Invalid Factor 2 payload. 4 digits required.' });
      }

      const user = db.findUserById(userId);
      if (!user) {
        return sendJSON(res, 404, { success: false, error: 'User not found.' });
      }

      const canonical = canonicalizeShiftedPin(candidate.tapCounts);
      const argon2idPhc = await hashPattern(canonical);

      db.saveSpacebarSecret({
        userId,
        schemeVersion: 'SB2',
        argon2idPhc,
        mode: 'PIN',
        expectedDigits: 4,
      });

      return sendJSON(res, 200, {
        success: true,
        message: 'Spacebar tactile secret enrolled successfully with Argon2id.',
        next: 'FACTOR_1_ENROLL',
      });
    }

    // Step 3: WebAuthn Registration Options
    if (req.method === 'POST' && pathname === '/api/register/webauthn/options') {
      const body = await parseBody(req);
      const userId = String(body.userId || '').trim();
      const user = db.findUserById(userId);
      if (!user) {
        return sendJSON(res, 404, { success: false, error: 'User not found.' });
      }

      const webAuthnUser: WebAuthnUser = {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
      };

      const existingCreds = db.findCredentialsByUserId(userId).map((c) => ({
        id: c.id,
        userId: c.user_id,
        publicKey: Buffer.from(c.public_key, 'base64'),
        signCount: c.sign_count,
        createdAt: new Date(c.created_at),
        transports: c.transports ? JSON.parse(c.transports) : undefined,
      }));

      // In registration, bypass gate via a temporary registration token
      const regToken = `reg_gate_${randomBytes(16).toString('hex')}`;
      const tempGateValidator: SessionGateValidator = {
        async validatePartialSession() {
          return { isValid: true, userId: user.id };
        },
      };

      const options = await generateRegistrationChallenge({
        user: webAuthnUser,
        sessionToken: regToken,
        gateValidator: tempGateValidator,
        existingCredentials: existingCreds,
        config,
        auditLogger: sqliteAuditLogger,
      });

      challengeCache.set(`reg_${user.id}`, options.challenge);
      return sendJSON(res, 200, options);
    }

    // Step 4: Verify WebAuthn Registration
    if (req.method === 'POST' && pathname === '/api/register/webauthn/verify') {
      const body = await parseBody(req);
      const userId = String(body.userId || '').trim();
      const user = db.findUserById(userId);
      if (!user) return sendJSON(res, 404, { success: false, error: 'User not found.' });

      const expectedChallenge = challengeCache.get(`reg_${user.id}`);
      if (!expectedChallenge) {
        return sendJSON(res, 400, { success: false, error: 'Registration challenge expired. Please retry.' });
      }

      const webAuthnUser: WebAuthnUser = {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
      };

      const tempGateValidator: SessionGateValidator = {
        async validatePartialSession() {
          return { isValid: true, userId: user.id };
        },
      };

      const result = await verifyRegistrationResponse({
        user: webAuthnUser,
        response: body.response,
        expectedChallenge,
        sessionToken: 'reg_token',
        gateValidator: tempGateValidator,
        config,
        auditLogger: sqliteAuditLogger,
        requireUserVerification: true,
      });

      // Save credential in SQLite
      db.saveWebAuthnCredential({
        id: result.credential.id,
        userId: user.id,
        publicKey: Buffer.from(result.credential.publicKey).toString('base64'),
        signCount: result.credential.signCount,
        transports: result.credential.transports,
      });

      challengeCache.delete(`reg_${user.id}`);

      return sendJSON(res, 200, {
        success: true,
        message: 'Account successfully registered with 2-Factor Authentication!',
        user: { id: user.id, username: user.username, displayName: user.display_name },
      });
    }

    // Authentication Endpoints (Reverse 2FA Flow)
    // Step 1: Claim Identity & Check Rate Limiting (D1)
    if (req.method === 'POST' && pathname === '/api/login/start') {
      const body = await parseBody(req);
      const username = String(body.username || '').toLowerCase().trim();

      if (!username) {
        return sendJSON(res, 400, { success: false, error: 'Username is required.' });
      }

      const user = db.findUserByUsername(username);
      if (!user) {
        return sendJSON(res, 404, { success: false, error: 'User account not found.' });
      }

      // Check D1 Rate Limiter
      const limitCheck = rateLimiter.checkRateLimit({ ipAddress, userId: user.id });
      if (limitCheck.isLockedOut) {
        const retryAfter = Math.ceil(limitCheck.remainingLockoutMs / 1000);
        db.logAttempt({
          id: `log_${Date.now()}_${randomBytes(4).toString('hex')}`,
          userId: user.id,
          factor: 'RATE_LIMITER',
          ceremony: 'LOGIN_START',
          outcome: 'RATE_LIMITED',
          reason: `Locked out. Retry in ${retryAfter}s`,
          ipAddress,
          userAgent,
        });
        return sendJSON(res, 429, {
          success: false,
          error: `Too many failed attempts. Account temporarily locked for ${retryAfter} seconds.`,
          retryAfterSeconds: retryAfter,
        });
      }

      const hasF2 = db.findSpacebarSecret(user.id);
      if (!hasF2) {
        return sendJSON(res, 400, { success: false, error: 'Factor 2 secret not enrolled for this account.' });
      }

      return sendJSON(res, 200, {
        success: true,
        userId: user.id,
        username: user.username,
        displayName: user.display_name,
        next: 'FACTOR_2_CHALLENGE',
      });
    }

    // Step 2: Factor 2 Spacebar Verification (Argon2id)
    if (req.method === 'POST' && pathname === '/api/login/factor2') {
      const body = await parseBody(req);
      const userId = String(body.userId || '').trim();
      const candidate = body.candidate;

      const user = db.findUserById(userId);
      if (!user) return sendJSON(res, 404, { success: false, error: 'User not found.' });

      // Check Rate Limit
      const limitCheck = rateLimiter.checkRateLimit({ ipAddress, userId });
      if (limitCheck.isLockedOut) {
        const retryAfter = Math.ceil(limitCheck.remainingLockoutMs / 1000);
        return sendJSON(res, 429, {
          success: false,
          error: `Locked out due to repeated failures. Retry in ${retryAfter}s.`,
          retryAfterSeconds: retryAfter,
        });
      }

      const storedSecret = db.findSpacebarSecret(userId);
      if (!storedSecret) {
        return sendJSON(res, 400, { success: false, error: 'No spacebar secret found for user.' });
      }

      let canonicalCandidate: string;
      try {
        if (!candidate || !Array.isArray(candidate.tapCounts) || candidate.tapCounts.length !== 4) {
          throw new Error('Invalid spacebar PIN input');
        }
        canonicalCandidate = canonicalizeShiftedPin(candidate.tapCounts);
      } catch (err: any) {
        return sendJSON(res, 400, { success: false, error: err.message || 'Invalid pattern format' });
      }

      const verified = await argon2.verify(storedSecret.argon2id_phc, canonicalCandidate);

      if (!verified) {
        await rateLimiter.recordFailedAttempt({ ipAddress, userId });
        db.logAttempt({
          id: `log_${Date.now()}_${randomBytes(4).toString('hex')}`,
          userId,
          factor: 'FACTOR_2_SPACEBAR',
          ceremony: 'AUTHENTICATION',
          outcome: 'FAILURE',
          reason: 'Tactile pattern mismatch',
          ipAddress,
          userAgent,
        });
        return sendJSON(res, 401, {
          success: false,
          error: 'Factor 2 tactile PIN verification failed.',
        });
      }

      // Success: Reset failure count and create PartialAuthSession (5 min TTL)
      rateLimiter.recordSuccess({ ipAddress, userId });
      const rawToken = randomBytes(32).toString('base64url');
      const tokenHash = hashToken(rawToken);
      const sessionId = `ses_${randomBytes(8).toString('hex')}`;
      const expiresAt = Date.now() + 5 * 60 * 1000; // 300s TTL

      db.createPartialSession({
        id: sessionId,
        userId,
        tokenHash,
        expiresAt,
      });

      db.logAttempt({
        id: `log_${Date.now()}_${randomBytes(4).toString('hex')}`,
        userId,
        factor: 'FACTOR_2_SPACEBAR',
        ceremony: 'AUTHENTICATION',
        outcome: 'SUCCESS',
        reason: 'Tactile secret verified',
        ipAddress,
        userAgent,
      });

      return sendJSON(res, 200, {
        success: true,
        next: 'FACTOR_1_BIOMETRIC',
        partialSessionToken: rawToken,
        expiresAt: new Date(expiresAt).toISOString(),
        ttlSeconds: 300,
      });
    }

    // Step 3: WebAuthn Auth Challenge Options (Enforcing D2 Gate)
    if (req.method === 'POST' && pathname === '/api/login/webauthn/options') {
      const body = await parseBody(req);
      const userId = String(body.userId || '').trim();
      const partialSessionToken = String(body.partialSessionToken || '').trim();

      const user = db.findUserById(userId);
      if (!user) return sendJSON(res, 404, { success: false, error: 'User not found.' });

      const credentials = db.findCredentialsByUserId(userId).map((c) => ({
        id: c.id,
        userId: c.user_id,
        publicKey: Buffer.from(c.public_key, 'base64'),
        signCount: c.sign_count,
        createdAt: new Date(c.created_at),
        transports: c.transports ? JSON.parse(c.transports) : undefined,
      }));

      if (credentials.length === 0) {
        return sendJSON(res, 400, { success: false, error: 'No WebAuthn biometric credentials registered.' });
      }

      const webAuthnUser: WebAuthnUser = {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
      };

      try {
        const options = await generateAuthenticationChallenge({
          user: webAuthnUser,
          sessionToken: partialSessionToken,
          gateValidator: sqliteSessionGateValidator,
          userCredentials: credentials,
          config,
          auditLogger: sqliteAuditLogger,
        });

        challengeCache.set(`auth_${user.id}`, options.challenge);
        return sendJSON(res, 200, options);
      } catch (err: any) {
        if (err instanceof SessionGateError) {
          return sendJSON(res, 403, { success: false, error: err.message, code: err.code });
        }
        return sendJSON(res, 500, { success: false, error: err.message });
      }
    }

    // Step 4: Verify WebAuthn Assertion & Issue Full Session
    if (req.method === 'POST' && pathname === '/api/login/webauthn/verify') {
      const body = await parseBody(req);
      const userId = String(body.userId || '').trim();
      const partialSessionToken = String(body.partialSessionToken || '').trim();

      const user = db.findUserById(userId);
      if (!user) return sendJSON(res, 404, { success: false, error: 'User not found.' });

      const expectedChallenge = challengeCache.get(`auth_${user.id}`);
      if (!expectedChallenge) {
        return sendJSON(res, 400, { success: false, error: 'Authentication challenge expired.' });
      }

      const credRow = db.findCredentialById(body.response?.id);
      if (!credRow || credRow.user_id !== user.id) {
        return sendJSON(res, 404, { success: false, error: 'Matching credential not found.' });
      }

      const storedCredential: StoredWebAuthnCredential = {
        id: credRow.id,
        userId: credRow.user_id,
        publicKey: Buffer.from(credRow.public_key, 'base64'),
        signCount: credRow.sign_count,
        createdAt: new Date(credRow.created_at),
        transports: credRow.transports ? JSON.parse(credRow.transports) : undefined,
      };

      const webAuthnUser: WebAuthnUser = {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
      };

      try {
        const result = await verifyAuthenticationAssertion({
          user: webAuthnUser,
          response: body.response,
          expectedChallenge,
          storedCredential,
          sessionToken: partialSessionToken,
          gateValidator: sqliteSessionGateValidator,
          config,
          auditLogger: sqliteAuditLogger,
          requireUserVerification: true,
        });

        // 1. Advance sign counter in database
        db.updateSignCount(credRow.id, result.newCounter);

        // 2. Consume partial session gate token (single-use)
        db.updatePartialSessionStatus(hashToken(partialSessionToken), 'CONSUMED');
        challengeCache.delete(`auth_${user.id}`);

        // 3. Issue Full Authenticated Session
        const fullSessionToken = `auth_${randomBytes(32).toString('base64url')}`;
        const session = db.createFullSession(fullSessionToken, user.id);

        return sendJSON(
          res,
          200,
          {
            success: true,
            sessionToken: fullSessionToken,
            expiresAt: new Date(session.expires_at).toISOString(),
            user: { id: user.id, username: user.username, displayName: user.display_name },
            next: 'AUTHENTICATED',
          },
          {
            'Set-Cookie': `tapkey_session=${fullSessionToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`,
          }
        );
      } catch (err: any) {
        if (err instanceof SessionGateError) {
          return sendJSON(res, 403, { success: false, error: err.message, code: err.code });
        }
        return sendJSON(res, 400, { success: false, error: err.message });
      }
    }

    // Session Management & Telemetry Endpoints
    if (req.method === 'GET' && pathname === '/api/me') {
      const token = getSessionToken(req);
      if (!token) {
        return sendJSON(res, 401, { success: false, error: 'Unauthorized. No session token.' });
      }

      const session = db.findFullSession(token);
      if (!session) {
        return sendJSON(res, 401, { success: false, error: 'Session invalid or expired.' });
      }

      const user = db.findUserById(session.user_id);
      if (!user) {
        return sendJSON(res, 404, { success: false, error: 'User not found.' });
      }

      const credentials = db.findCredentialsByUserId(user.id).map((c) => ({
        id: c.id,
        signCount: c.sign_count,
        transports: c.transports ? JSON.parse(c.transports) : [],
        createdAt: new Date(c.created_at).toISOString(),
        lastUsedAt: c.last_used_at ? new Date(c.last_used_at).toISOString() : null,
      }));

      const spacebarSecret = db.findSpacebarSecret(user.id);
      const recentLogs = db.getRecentLogs(20);

      return sendJSON(res, 200, {
        success: true,
        user: { id: user.id, username: user.username, displayName: user.display_name, createdAt: new Date(user.created_at).toISOString() },
        credentials,
        hasFactor2Secret: !!spacebarSecret,
        session: { expiresAt: new Date(session.expires_at).toISOString() },
        logs: recentLogs,
      });
    }

    if (req.method === 'POST' && pathname === '/api/logout') {
      const token = getSessionToken(req);
      if (token) {
        db.deleteFullSession(token);
      }
      return sendJSON(
        res,
        200,
        { success: true, message: 'Logged out successfully.' },
        { 'Set-Cookie': 'tapkey_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0' }
      );
    }

    if (req.method === 'GET' && pathname === '/api/logs') {
      const logs = db.getRecentLogs(50);
      return sendJSON(res, 200, { success: true, logs });
    }

    sendJSON(res, 404, { success: false, error: 'Endpoint not found' });
  } catch (err: any) {
    console.error('Unhandled Server Error:', err);
    sendJSON(res, 500, { success: false, error: err.message || 'Internal Server Error' });
  }
});

server.listen(PORT, () => {
  console.log(`TapKey Authentication Server running on http://localhost:${PORT}`);
});
