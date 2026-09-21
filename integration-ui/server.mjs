import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { InMemoryPartialAuthSessionStore } from '../server/src/sessionManager.ts';
import { LoginOrchestrator } from '../server/src/orchestrator.ts';
import {
  generateRegistrationChallenge, verifyRegistrationResponse,
  generateAuthenticationChallenge, verifyAuthenticationAssertion,
} from '../factor1-webauthn/dist/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const factor2Root = process.env.FACTOR2_ROOT;
if (!factor2Root) throw new Error('Set FACTOR2_ROOT to the clean Thashira factor2-spacebar directory');
const f2 = await import(pathToFileURL(path.join(factor2Root, 'dist/index.js')).href);
const { InMemorySpacebarSecretRepository } = await import(pathToFileURL(path.join(factor2Root, 'dist/server/SpacebarSecretRepository.js')).href);
const secrets = new InMemorySpacebarSecretRepository();
const sessions = new InMemoryPartialAuthSessionStore();
const credentials = new Map();
const challenges = new Map();
const port = Number(process.env.PORT || 5190);
const origin = `http://localhost:${port}`;
const config = { rpName: 'TapKey local integration test', rpID: 'localhost', origin };
const user = (id) => ({ id, username: id, displayName: id });
const gateValidator = { validatePartialSession: (token, id) => sessions.validatePartialSession(token, id) };
const orchestrator = new LoginOrchestrator(
  sessions,
  { async verify({ userId, tapPattern }) {
    const result = await f2.verifyPattern(userId, tapPattern, secrets);
    return { verified: result.success, reason: result.success ? undefined : result.reason };
  } },
  { async verify({ userId, partialSessionToken, assertion }) {
    const key = `${userId}:${partialSessionToken}`;
    const challenge = challenges.get(key);
    if (!challenge || challenge.kind !== 'authentication') return { verified: false, reason: 'MISSING_CHALLENGE' };
    const credential = (credentials.get(userId) || []).find((entry) => entry.id === assertion?.id);
    if (!credential) return { verified: false, reason: 'UNKNOWN_CREDENTIAL' };
    const result = await verifyAuthenticationAssertion({
      user: user(userId), response: assertion, expectedChallenge: challenge.value,
      storedCredential: credential, sessionToken: partialSessionToken, gateValidator, config,
    });
    if (result.verified) {
      credential.signCount = result.updatedSignCount;
      credential.lastUsedAt = new Date();
      challenges.delete(key);
    }
    return { verified: result.verified };
  } },
  { async issue() { return { sessionToken: randomBytes(32).toString('base64url') }; } },
);

const staticFiles = new Map([
  ['/', [path.join(here, 'index.html'), 'text/html; charset=utf-8']],
  ['/smoke', [path.join(here, 'smoke.html'), 'text/html; charset=utf-8']],
  ['/client.js', [path.join(here, 'client.js'), 'text/javascript; charset=utf-8']],
  ['/factor2-capture.js', [path.join(here, '.build/factor2-capture.js'), 'text/javascript; charset=utf-8']],
  ['/webauthn.js', [path.join(root, 'factor1-webauthn/node_modules/@simplewebauthn/browser/dist/bundle/index.umd.min.js'), 'text/javascript; charset=utf-8']],
  ['/a11y/index.js', [path.join(root, 'accessibility-engine/src/index.js'), 'text/javascript; charset=utf-8']],
  ['/a11y/liveRegion.js', [path.join(root, 'accessibility-engine/src/liveRegion.js'), 'text/javascript; charset=utf-8']],
  ['/a11y/earconPlayer.js', [path.join(root, 'accessibility-engine/src/earconPlayer.js'), 'text/javascript; charset=utf-8']],
  ['/a11y/keyHandler.js', [path.join(root, 'accessibility-engine/src/keyHandler.js'), 'text/javascript; charset=utf-8']],
  ['/a11y/liveRegion.css', [path.join(root, 'accessibility-engine/src/liveRegion.css'), 'text/css; charset=utf-8']],
]);
function reply(response, code, data) {
  response.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(data));
}
async function body(request) {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 100_000) throw new Error('Request too large');
  }
  return JSON.parse(raw || '{}');
}
function requireIdentity(data) {
  if (typeof data.userId !== 'string' || !/^[a-zA-Z0-9_.-]{1,64}$/.test(data.userId)) throw new Error('Enter a username using letters, numbers, dots, underscores, or hyphens');
}
function requirePattern(data) {
  if (data.pattern?.mode !== 'COUNT' || !Array.isArray(data.pattern.groups) || data.pattern.groups.length !== 4) throw new Error('Record four tap groups first');
  return f2.canonicalizeCountPattern(data.pattern.groups);
}
const routes = {
  '/api/login/start': async (data) => { requireIdentity(data); return orchestrator.beginLogin(data.userId); },
  '/api/enroll/spacebar': async (data) => {
    requireIdentity(data);
    const canonical = requirePattern(data);
    await secrets.save({ userId: data.userId, mode: 'COUNT', schemeVersion: 'SB1', expectedUnits: 4, argon2idPhc: await f2.hashPattern(canonical) });
    return { enrolled: true };
  },
  '/api/login/factor2': async (data) => {
    requireIdentity(data); requirePattern(data);
    return orchestrator.verifyFactor2({ userId: data.userId, tapPattern: data.pattern });
  },
  '/api/webauthn/register/options': async (data) => {
    requireIdentity(data);
    const options = await generateRegistrationChallenge({ user: user(data.userId), sessionToken: data.token, gateValidator, existingCredentials: credentials.get(data.userId) || [], config });
    challenges.set(`${data.userId}:${data.token}`, { kind: 'registration', value: options.challenge });
    return options;
  },
  '/api/webauthn/register/verify': async (data) => {
    requireIdentity(data);
    const key = `${data.userId}:${data.token}`;
    const challenge = challenges.get(key);
    if (challenge?.kind !== 'registration') throw new Error('Registration challenge missing');
    const result = await verifyRegistrationResponse({ user: user(data.userId), response: data.response, expectedChallenge: challenge.value, sessionToken: data.token, gateValidator, config });
    if (result.verified) {
      credentials.set(data.userId, [...(credentials.get(data.userId) || []), result.credential]);
      challenges.delete(key);
    }
    return { verified: result.verified };
  },
  '/api/webauthn/auth/options': async (data) => {
    requireIdentity(data);
    const options = await generateAuthenticationChallenge({ user: user(data.userId), sessionToken: data.token, gateValidator, userCredentials: credentials.get(data.userId) || [], config });
    challenges.set(`${data.userId}:${data.token}`, { kind: 'authentication', value: options.challenge });
    return options;
  },
  '/api/webauthn/auth/verify': async (data) => {
    requireIdentity(data);
    return orchestrator.verifyFactor1({ userId: data.userId, partialSessionToken: data.token, assertion: data.response });
  },
};
createServer(async (request, response) => {
  const pathname = new URL(request.url, origin).pathname;
  try {
    if (request.method === 'POST' && routes[pathname]) {
      try { reply(response, 200, await routes[pathname](await body(request))); }
      catch (error) { reply(response, 400, { error: error instanceof Error ? error.message : 'Request failed' }); }
      return;
    }
    let file = staticFiles.get(pathname);
    if (!file && pathname.startsWith('/factor2/')) {
      const relative = pathname.slice('/factor2/'.length);
      if (!/^[a-zA-Z0-9_./-]+\.js$/.test(relative) || relative.includes('..')) { reply(response, 404, { error: 'Not found' }); return; }
      file = [path.join(factor2Root, 'dist', relative), 'text/javascript; charset=utf-8'];
    }
    if (request.method !== 'GET' || !file) { reply(response, 404, { error: 'Not found' }); return; }
    response.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-store' });
    response.end(await readFile(file[0]));
  } catch { reply(response, 500, { error: 'Unable to serve file' }); }
}).listen(port, 'localhost', () => console.log(`Integration UI: ${origin}`));
