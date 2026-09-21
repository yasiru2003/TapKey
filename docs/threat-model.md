# 🛡️ TapKey Threat Model and Security Proofs

## 1. Overview and Asset Classification

TapKey protects user authentication for visually impaired users. The primary assets protected by the system include:
1. **User Identity & Full Authenticated Sessions**
2. **WebAuthn FIDO2 Private Keys and Public Key Assertions**
3. **Tactile Spacebar Secrets (`SpacebarSecret`)**
4. **Short-Lived Session Gate Tokens (`PartialAuthSession`)**
5. **Out-of-Band Account Recovery Tokens (`RecoveryToken`)**

---

## 2. Threat Vector Analysis & Mitigations

### 2.1 Physical Theft / Compromise of Platform Authenticator
* **Threat**: An adversary steals the user's laptop or mobile device containing the hardware platform authenticator (e.g., TouchID / Windows Hello).
* **Vulnerability in Standard 1FA/WebAuthn**: The adversary might coerce or bypass local biometric unlock and immediately gain full session access.
* **TapKey Mitigation (Core Invariant D2)**:
  - FIDO2 / WebAuthn assertions cannot be initiated or accepted without first presenting a valid `PartialAuthSession`.
  - The `PartialAuthSession` requires knowledge of the tactile spacebar secret, which is not stored in the hardware authenticator chip.
  - Therefore, physical possession of the platform authenticator alone is insufficient to authenticate.

---

### 2.2 Shoulder Surfing & Visual Observation
* **Threat**: An adversary watches the user while they authenticate to observe passwords or screen prompts.
* **TapKey Mitigation**:
  - The spacebar secret is tactile (rhythm cadence or tap intervals), entered on a single key.
  - The UI does not display characters, dots, or reveal the count/pattern visually.
  - Earcons provide audio feedback via private headphones so observers cannot hear the audio cues.

---

### 2.3 Brute-Force and Credential Stuffing on Low-Entropy Factor 2
* **Threat**: The tactile spacebar secret has relatively low entropy compared to long alphanumeric passwords.
* **TapKey Mitigation (Design D1)**:
  - **Argon2id Hashing**: Server-side password hashing with memory cost `19456 KiB`, time cost `2`, and parallelism `1` prevents fast offline and online rainbow table attacks.
  - **Adaptive Rate Limiting & Exponential Lockout**: After consecutive failed attempts (e.g. 3 failures), exponential lockout delays are applied per IP and username.
  - **Unified Audit Logging**: Every failed attempt is recorded in `LoginAttempt` for anomaly detection.

---

### 2.4 Replay and Session Gate Forgery Attacks
* **Threat**: An attacker captures a network packet with a `PartialAuthSession` token or attempts to forge a gate token.
* **TapKey Mitigation**:
  - `PartialAuthSession` tokens are cryptographically random 256-bit base64url strings.
  - The database only stores the SHA-256 hash of the token (`tokenHash`), preventing token extraction from database read compromises.
  - Tokens have a strict **5-minute (300s) TTL**.
  - Tokens are strictly **single-use**: once Factor 1 completes, the token is permanently marked `CONSUMED`.

---

### 2.5 WebAuthn Assertion Replay and Authenticator Cloning
* **Threat**: An attacker captures a signed WebAuthn assertion and attempts to replay it.
* **TapKey Mitigation**:
  - Relying Party generates a cryptographically random, single-use server challenge.
  - Signature counter (`sign_count`) is monotonically incremented by hardware authenticators and strictly validated by `@simplewebauthn` in `factor1-webauthn`. Cloned authenticators with falling counters are immediately rejected and flagged in `LoginAttempt`.

---

### 2.6 Out-of-Band Recovery Attacks (Design D6)
* **Threat**: An attacker attempts to abuse recovery channels to hijack an account.
* **TapKey Mitigation**:
  - Recovery tokens are cryptographically signed, short-lived magic tokens sent out-of-band to verified email.
  - Invoking recovery immediately terminates existing partial sessions and forces full re-enrollment of both Factor 1 and Factor 2 credentials.

---

### 2.7 Network & Web Application Security Hygiene (Design D7)
* **Threat**: Man-in-the-middle (MITM), cross-site scripting (XSS), cross-site request forgery (CSRF).
* **TapKey Mitigation**:
  - Strict HTTPS transport enforced on all endpoints.
  - Full session cookies set with `SameSite=Strict`, `HttpOnly`, and `Secure` attributes.
  - Anti-CSRF double submit tokens or custom request headers enforced on state-changing API endpoints.

---

## 3. STRIDE Threat Analysis Matrix

| Threat Category | Target Component | Specific Threat | TapKey Countermeasure |
| :--- | :--- | :--- | :--- |
| **Spoofing** | Factor 1 (WebAuthn) | Fake biometric assertion | Asymmetric key signature verification + hardware origin/challenge binding. |
| **Spoofing** | Factor 2 (Spacebar) | Guessed tap pattern | Adaptive rate limiting (D1) + Argon2id memory-hard verification. |
| **Tampering** | Session Gate | Forged gate token | Cryptographic token hashing + database TTL validation (D2). |
| **Repudiation** | Login Lifecycle | Disputed authentication attempts | Centralized, tamper-evident `LoginAttempt` audit logs. |
| **Information Disclosure** | Accessibility UI | Spoken secrets via TTS | ARIA live regions only announce state changes, never raw key counts or rhythm patterns. |
| **Denial of Service** | Authentication API | Automated spacebar brute force | Dual-layer rate limiting (per-user and per-IP). |
| **Elevation of Privilege** | Factor 1 Endpoint | Direct invocation bypassing Factor 2 | Strict `SessionGateValidator` hook rejects requests without an active `PartialAuthSession`. |
