# 🔐 Factor 1 — WebAuthn / FIDO2 Authentication Module

> **Owner**: Yasiru (`230076R`)  
> **Package**: `@tapkey/factor1-webauthn`  
> **Security Protocol**: TapKey Accessible 2FA Protocol

---

## 📖 Module Summary

The **Factor 1** module provides hardware-backed FIDO2 / WebAuthn biometric authentication (Touch ID, Windows Hello, Face ID, Apple Passkeys) with **strict enforcement of Design Choice D2**.

### 🔒 Invariants & Security Guarantees
1. **Design Choice D2 Enforcement**: Rejects 100% of Factor 1 requests (challenge generation or assertion verification) if the client does not hold an active, unexpired `PartialAuthSession` from Factor 2.
2. **Anti-Replay Counter Tracking**: Validates and tracks `sign_count` progression on stored credentials to detect cloned authenticators or replay attacks.
3. **Audit Logging Integration**: Emits structured telemetry (`SUCCESS`, `FAILURE`, `BLOCKED_SESSION_GATE`) to Hasini's `LoginAttempt` logging engine.

---

## 📦 API Surface & Exports

### 1. Server-Side APIs

```typescript
import {
  generateRegistrationChallenge,
  verifyRegistrationResponse,
  generateAuthenticationChallenge,
  verifyAuthenticationAssertion,
  assertSessionGateActive,
} from '@tapkey/factor1-webauthn';
```

#### `generateRegistrationChallenge(params)`
- **Purpose**: Generates WebAuthn registration options for platform authenticators.
- **Parameters**: `user`, `sessionToken`, `gateValidator`, `existingCredentials`, `config`, `auditLogger`.
- **Throws**: `SessionGateError` (if session invalid), `WebAuthnVerificationError`.

#### `verifyRegistrationResponse(params)`
- **Purpose**: Cryptographically verifies client attestation and returns the newly registered credential.
- **Returns**: `{ verified: true, credential: StoredWebAuthnCredential }`.

#### `generateAuthenticationChallenge(params)`
- **Purpose**: Generates WebAuthn authentication challenge for enrolled user credentials.
- **Parameters**: `user`, `sessionToken`, `gateValidator`, `userCredentials`, `config`, `auditLogger`.

#### `verifyAuthenticationAssertion(params)`
- **Purpose**: Cryptographically verifies the signature against stored public key bytes and checks `sign_count`.
- **Returns**: `{ verified: true, credentialId: string, updatedSignCount: number, newCounter: number }`.

---

## 🤝 Integration Contracts for Teammates

### For Senadi (`/server/`) — Session Gate Hook
```typescript
import type { SessionGateValidator } from '@tapkey/factor1-webauthn';

export const sessionGateValidator: SessionGateValidator = {
  async validatePartialSession(sessionToken: string, userId: string) {
    // 1. Query PartialAuthSession table
    // 2. Verify expiry (TTL <= 300s) and user match
    return { isValid: true, userId };
  },
};
```

### For Hasini (`/security/`) — Audit Logging Hook
```typescript
import type { AuditLogger, AuditLogEntry } from '@tapkey/factor1-webauthn';

export const auditLogger: AuditLogger = {
  async logAttempt(entry: AuditLogEntry) {
    // Write entry to LoginAttempt table
  },
};
```

---

## 🧪 Local Testing & Verification

### Running Automated Unit Tests
```bash
npm test
```

### Running Standalone Interactive Test Server
```bash
npm run demo
# Access interactive UI at http://localhost:8085
```
