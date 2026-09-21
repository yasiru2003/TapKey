import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const DB_PATH = process.env.DATABASE_PATH || path.resolve(process.cwd(), 'tapkey.db');

export interface UserRow {
  id: string;
  username: string;
  display_name: string;
  created_at: number;
  updated_at: number;
}

export interface SpacebarSecretRow {
  user_id: string;
  scheme_version: string;
  argon2id_phc: string;
  mode: string;
  expected_digits: number | null;
  threshold_ms: number | null;
  tolerance_ms: number | null;
  created_at: number;
  updated_at: number;
}

export interface WebAuthnCredentialRow {
  id: string;
  user_id: string;
  public_key: string; // Base64
  sign_count: number;
  transports: string | null; // JSON string
  created_at: number;
  last_used_at: number | null;
}

export interface PartialAuthSessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  status: string; // 'ACTIVE' | 'EXPIRED' | 'CONSUMED'
  created_at: number;
  expires_at: number;
}

export interface FullSessionRow {
  token: string;
  user_id: string;
  created_at: number;
  expires_at: number;
}

export interface LoginAttemptRow {
  id: string;
  user_id: string;
  factor: string;
  ceremony: string | null;
  outcome: string;
  reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  timestamp: number;
}

export class TapKeyDatabase {
  private db: DatabaseSync;

  constructor(filePath = DB_PATH) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new DatabaseSync(filePath);
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.initTables();
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS spacebar_secrets (
        user_id TEXT PRIMARY KEY,
        scheme_version TEXT NOT NULL,
        argon2id_phc TEXT NOT NULL,
        mode TEXT NOT NULL,
        expected_digits INTEGER,
        threshold_ms INTEGER,
        tolerance_ms INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS webauthn_credentials (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        public_key TEXT NOT NULL,
        sign_count INTEGER NOT NULL DEFAULT 0,
        transports TEXT,
        created_at INTEGER NOT NULL,
        last_used_at INTEGER,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS partial_auth_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT UNIQUE NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS full_sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS login_attempts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        factor TEXT NOT NULL,
        ceremony TEXT,
        outcome TEXT NOT NULL,
        reason TEXT,
        ip_address TEXT,
        user_agent TEXT,
        timestamp INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON partial_auth_sessions(token_hash);
      CREATE INDEX IF NOT EXISTS idx_attempts_user ON login_attempts(user_id, timestamp);
    `);
  }

  // --- User Operations ---
  createUser(id: string, username: string, displayName: string): UserRow {
    const now = Date.now();
    const stmt = this.db.prepare(
      'INSERT INTO users (id, username, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    );
    stmt.run(id, username.toLowerCase().trim(), displayName.trim(), now, now);
    return { id, username: username.toLowerCase().trim(), display_name: displayName.trim(), created_at: now, updated_at: now };
  }

  findUserById(id: string): UserRow | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    const result = stmt.get(id) as UserRow | undefined;
    return result || null;
  }

  findUserByUsername(username: string): UserRow | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
    const result = stmt.get(username.toLowerCase().trim()) as UserRow | undefined;
    return result || null;
  }

  // --- Spacebar Secret Operations ---
  saveSpacebarSecret(secret: {
    userId: string;
    schemeVersion: string;
    argon2idPhc: string;
    mode: string;
    expectedDigits?: number;
    thresholdMs?: number;
    toleranceMs?: number;
  }): void {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO spacebar_secrets (user_id, scheme_version, argon2id_phc, mode, expected_digits, threshold_ms, tolerance_ms, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        scheme_version = excluded.scheme_version,
        argon2id_phc = excluded.argon2id_phc,
        mode = excluded.mode,
        expected_digits = excluded.expected_digits,
        threshold_ms = excluded.threshold_ms,
        tolerance_ms = excluded.tolerance_ms,
        updated_at = excluded.updated_at
    `);
    stmt.run(
      secret.userId,
      secret.schemeVersion,
      secret.argon2idPhc,
      secret.mode,
      secret.expectedDigits ?? null,
      secret.thresholdMs ?? null,
      secret.toleranceMs ?? null,
      now,
      now
    );
  }

  findSpacebarSecret(userId: string): SpacebarSecretRow | null {
    const stmt = this.db.prepare('SELECT * FROM spacebar_secrets WHERE user_id = ?');
    const result = stmt.get(userId) as SpacebarSecretRow | undefined;
    return result || null;
  }

  // --- WebAuthn Credential Operations ---
  saveWebAuthnCredential(cred: {
    id: string;
    userId: string;
    publicKey: string; // Base64
    signCount: number;
    transports?: string[];
  }): void {
    const now = Date.now();
    const transportsStr = cred.transports ? JSON.stringify(cred.transports) : null;
    const stmt = this.db.prepare(`
      INSERT INTO webauthn_credentials (id, user_id, public_key, sign_count, transports, created_at, last_used_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        sign_count = excluded.sign_count,
        last_used_at = excluded.last_used_at
    `);
    stmt.run(cred.id, cred.userId, cred.publicKey, cred.signCount, transportsStr, now, null);
  }

  updateSignCount(id: string, newCounter: number): void {
    const now = Date.now();
    const stmt = this.db.prepare('UPDATE webauthn_credentials SET sign_count = ?, last_used_at = ? WHERE id = ?');
    stmt.run(newCounter, now, id);
  }

  findCredentialsByUserId(userId: string): WebAuthnCredentialRow[] {
    const stmt = this.db.prepare('SELECT * FROM webauthn_credentials WHERE user_id = ? ORDER BY created_at DESC');
    return stmt.all(userId) as unknown as WebAuthnCredentialRow[];
  }

  findCredentialById(id: string): WebAuthnCredentialRow | null {
    const stmt = this.db.prepare('SELECT * FROM webauthn_credentials WHERE id = ?');
    const result = stmt.get(id) as WebAuthnCredentialRow | undefined;
    return result || null;
  }

  // --- Partial Session Operations ---
  createPartialSession(session: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: number;
  }): void {
    const now = Date.now();
    const stmt = this.db.prepare(
      'INSERT INTO partial_auth_sessions (id, user_id, token_hash, status, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    stmt.run(session.id, session.userId, session.tokenHash, 'ACTIVE', now, session.expiresAt);
  }

  findPartialSessionByTokenHash(tokenHash: string): PartialAuthSessionRow | null {
    const stmt = this.db.prepare('SELECT * FROM partial_auth_sessions WHERE token_hash = ?');
    const result = stmt.get(tokenHash) as PartialAuthSessionRow | undefined;
    return result || null;
  }

  updatePartialSessionStatus(tokenHash: string, status: 'EXPIRED' | 'CONSUMED'): void {
    const stmt = this.db.prepare('UPDATE partial_auth_sessions SET status = ? WHERE token_hash = ?');
    stmt.run(status, tokenHash);
  }

  // --- Full Authenticated Session Operations ---
  createFullSession(token: string, userId: string, ttlMs = 24 * 60 * 60 * 1000): FullSessionRow {
    const now = Date.now();
    const expiresAt = now + ttlMs;
    const stmt = this.db.prepare(
      'INSERT INTO full_sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
    );
    stmt.run(token, userId, now, expiresAt);
    return { token, user_id: userId, created_at: now, expires_at: expiresAt };
  }

  findFullSession(token: string): FullSessionRow | null {
    const now = Date.now();
    const stmt = this.db.prepare('SELECT * FROM full_sessions WHERE token = ? AND expires_at > ?');
    const result = stmt.get(token, now) as FullSessionRow | undefined;
    return result || null;
  }

  deleteFullSession(token: string): void {
    const stmt = this.db.prepare('DELETE FROM full_sessions WHERE token = ?');
    stmt.run(token);
  }

  // --- Audit Log Operations ---
  logAttempt(entry: {
    id: string;
    userId: string;
    factor: string;
    ceremony?: string;
    outcome: string;
    reason?: string;
    ipAddress?: string;
    userAgent?: string;
  }): void {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO login_attempts (id, user_id, factor, ceremony, outcome, reason, ip_address, user_agent, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      entry.id,
      entry.userId,
      entry.factor,
      entry.ceremony ?? null,
      entry.outcome,
      entry.reason ?? null,
      entry.ipAddress ?? null,
      entry.userAgent ?? null,
      now
    );
  }

  getRecentLogs(limit = 30): LoginAttemptRow[] {
    const stmt = this.db.prepare('SELECT * FROM login_attempts ORDER BY timestamp DESC LIMIT ?');
    return stmt.all(limit) as unknown as LoginAttemptRow[];
  }
}

export const db = new TapKeyDatabase();
