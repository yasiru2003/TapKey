import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  generateRegistrationChallenge,
  verifyRegistrationResponse,
  generateAuthenticationChallenge,
  verifyAuthenticationAssertion,
  SessionGateError,
  WebAuthnVerificationError,
  type StoredWebAuthnCredential,
  type WebAuthnUser,
  type SessionGateValidator,
  type AuditLogger,
  type AuditLogEntry,
  type WebAuthnServerConfig,
} from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 8085;
const RP_ID = 'localhost';
const EXPECTED_ORIGIN = `http://localhost:${PORT}`;

const config: WebAuthnServerConfig = {
  rpName: 'TapKey Local Test Suite',
  rpID: RP_ID,
  origin: EXPECTED_ORIGIN,
  timeout: 60000,
};

// Simulated Test User
const testUser: WebAuthnUser = {
  id: 'usr_yasiru_230076r',
  username: 'yasiru2003',
  displayName: 'Yasiru (Factor 1 Dev)',
};

// In-Memory State for Local Testing
let sessionState: 'ACTIVE' | 'EXPIRED' | 'MISSING' = 'ACTIVE';
const ACTIVE_SESSION_TOKEN = 'mock_partial_session_token_xyz987';

// Stored WebAuthn Credentials in Memory
const credentialsDB = new Map<string, StoredWebAuthnCredential[]>();
credentialsDB.set(testUser.id, []);

// In-Memory Audit Logs
const auditLogs: (AuditLogEntry & { id: string })[] = [];

// Session Gate Validator implementing Design D2
const mockSessionGateValidator: SessionGateValidator = {
  async validatePartialSession(sessionToken: string, userId: string) {
    if (sessionState === 'MISSING' || sessionToken !== ACTIVE_SESSION_TOKEN) {
      return {
        isValid: false,
        reason: 'SESSION_NOT_FOUND',
      };
    }
    if (sessionState === 'EXPIRED') {
      return {
        isValid: false,
        reason: 'SESSION_EXPIRED',
      };
    }
    if (userId !== testUser.id) {
      return {
        isValid: false,
        reason: 'SESSION_USER_MISMATCH',
      };
    }
    return {
      isValid: true,
      userId,
      expiresAt: new Date(Date.now() + 300000),
    };
  },
};

// Audit Logger implementing Hasini's LoginAttempt table contract
const mockAuditLogger: AuditLogger = {
  async logAttempt(entry: AuditLogEntry) {
    const record = {
      ...entry,
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: entry.timestamp || new Date(),
    };
    auditLogs.unshift(record);
    console.log(`[AUDIT LOG] ${entry.factor} | ${entry.ceremony} | ${entry.outcome} | ${entry.reason || 'OK'}`);
  },
};

// Ephemeral challenge cache for verification
const currentChallenges = new Map<string, string>();

// Helper to parse JSON request body
function parseRequestBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
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
function sendJSON(res: http.ServerResponse, statusCode: number, data: any) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data, null, 2));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const pathname = url.pathname;

  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // 1. Serve HTML UI
  if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
    const htmlPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(htmlPath));
      return;
    }
  }

  // 2. Session State Management
  if (req.method === 'GET' && pathname === '/api/status') {
    const userCredentials = credentialsDB.get(testUser.id) || [];
    return sendJSON(res, 200, {
      sessionState,
      sessionToken: sessionState === 'ACTIVE' ? ACTIVE_SESSION_TOKEN : (sessionState === 'EXPIRED' ? 'expired_token' : ''),
      user: testUser,
      credentials: userCredentials.map((c) => ({
        id: c.id,
        signCount: c.signCount,
        transports: c.transports,
        createdAt: c.createdAt,
      })),
      logs: auditLogs.slice(0, 30),
    });
  }

  if (req.method === 'POST' && pathname === '/api/session/set') {
    const body = await parseRequestBody(req);
    if (['ACTIVE', 'EXPIRED', 'MISSING'].includes(body.state)) {
      sessionState = body.state;
      return sendJSON(res, 200, { success: true, sessionState });
    }
    return sendJSON(res, 400, { error: 'Invalid state parameter' });
  }

  // 3. WebAuthn Registration
  if (req.method === 'POST' && pathname === '/api/webauthn/register/options') {
    try {
      const userCredentials = credentialsDB.get(testUser.id) || [];
      const token = sessionState === 'ACTIVE' ? ACTIVE_SESSION_TOKEN : (sessionState === 'EXPIRED' ? 'expired_token' : '');

      const options = await generateRegistrationChallenge({
        user: testUser,
        sessionToken: token,
        gateValidator: mockSessionGateValidator,
        existingCredentials: userCredentials,
        config,
        auditLogger: mockAuditLogger,
      });

      currentChallenges.set(`reg_${testUser.id}`, options.challenge);
      return sendJSON(res, 200, options);
    } catch (error) {
      if (error instanceof SessionGateError) {
        return sendJSON(res, 403, { error: error.message, code: error.code });
      }
      return sendJSON(res, 500, { error: (error as Error).message });
    }
  }

  if (req.method === 'POST' && pathname === '/api/webauthn/register/verify') {
    try {
      const body = await parseRequestBody(req);
      const expectedChallenge = currentChallenges.get(`reg_${testUser.id}`);
      if (!expectedChallenge) {
        return sendJSON(res, 400, { error: 'No active registration challenge found' });
      }

      const token = sessionState === 'ACTIVE' ? ACTIVE_SESSION_TOKEN : (sessionState === 'EXPIRED' ? 'expired_token' : '');

      const result = await verifyRegistrationResponse({
        user: testUser,
        response: body.response,
        expectedChallenge,
        sessionToken: token,
        gateValidator: mockSessionGateValidator,
        config,
        auditLogger: mockAuditLogger,
        requireUserVerification: true,
      });

      // Save credential
      const list = credentialsDB.get(testUser.id) || [];
      list.push(result.credential);
      credentialsDB.set(testUser.id, list);
      currentChallenges.delete(`reg_${testUser.id}`);

      return sendJSON(res, 200, { success: true, credential: result.credential });
    } catch (error) {
      if (error instanceof SessionGateError) {
        return sendJSON(res, 403, { error: error.message, code: error.code });
      }
      return sendJSON(res, 400, { error: (error as Error).message });
    }
  }

  // 4. WebAuthn Authentication
  if (req.method === 'POST' && pathname === '/api/webauthn/auth/options') {
    try {
      const userCredentials = credentialsDB.get(testUser.id) || [];
      const token = sessionState === 'ACTIVE' ? ACTIVE_SESSION_TOKEN : (sessionState === 'EXPIRED' ? 'expired_token' : '');

      const options = await generateAuthenticationChallenge({
        user: testUser,
        sessionToken: token,
        gateValidator: mockSessionGateValidator,
        userCredentials,
        config,
        auditLogger: mockAuditLogger,
      });

      currentChallenges.set(`auth_${testUser.id}`, options.challenge);
      return sendJSON(res, 200, options);
    } catch (error) {
      if (error instanceof SessionGateError) {
        return sendJSON(res, 403, { error: error.message, code: error.code });
      }
      if (error instanceof WebAuthnVerificationError) {
        return sendJSON(res, 400, { error: error.message, code: error.code });
      }
      return sendJSON(res, 500, { error: (error as Error).message });
    }
  }

  if (req.method === 'POST' && pathname === '/api/webauthn/auth/verify') {
    try {
      const body = await parseRequestBody(req);
      const expectedChallenge = currentChallenges.get(`auth_${testUser.id}`);
      if (!expectedChallenge) {
        return sendJSON(res, 400, { error: 'No active authentication challenge found' });
      }

      const userCredentials = credentialsDB.get(testUser.id) || [];
      const matchingCred = userCredentials.find((c) => c.id === body.response.id);
      if (!matchingCred) {
        return sendJSON(res, 404, { error: 'Credential ID not registered for this user' });
      }

      const token = sessionState === 'ACTIVE' ? ACTIVE_SESSION_TOKEN : (sessionState === 'EXPIRED' ? 'expired_token' : '');

      const result = await verifyAuthenticationAssertion({
        user: testUser,
        response: body.response,
        expectedChallenge,
        storedCredential: matchingCred,
        sessionToken: token,
        gateValidator: mockSessionGateValidator,
        config,
        auditLogger: mockAuditLogger,
        requireUserVerification: true,
      });

      // Update counter in DB
      matchingCred.signCount = result.newCounter;
      matchingCred.lastUsedAt = new Date();
      currentChallenges.delete(`auth_${testUser.id}`);

      return sendJSON(res, 200, { success: true, result });
    } catch (error) {
      if (error instanceof SessionGateError) {
        return sendJSON(res, 403, { error: error.message, code: error.code });
      }
      return sendJSON(res, 400, { error: (error as Error).message });
    }
  }

  // 5. Reset Test Database
  if (req.method === 'POST' && pathname === '/api/reset') {
    credentialsDB.set(testUser.id, []);
    auditLogs.length = 0;
    sessionState = 'ACTIVE';
    return sendJSON(res, 200, { success: true, message: 'Reset completed' });
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`Factor 1 Test Suite running on http://localhost:${PORT}`);
});
