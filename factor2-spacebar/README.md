# Factor 2 - Spacebar Tactile Knowledge Secret

Owner: W.G.T. Devindu - 230134U

## Scope

<<<<<<< HEAD
This Factor 2 module implements a four-digit tactile PIN entered with the spacebar. Each digit is entered by pressing Space between one and ten times, with a shifted mapping so that 1 tap = 0, 2 taps = 1, ..., 10 taps = 9. The module captures the four digits, converts them to a canonical `SB2|PIN|####` value, hashes it with Argon2id, and reports only PASS/FAIL for Factor 2 verification. It never creates a full session or WebAuthn flow.

## Canonical format

The canonical representation is versioned and fixed to the current design:

- example PIN: `5072`
- canonical value: `SB2|PIN|5072`

The value is derived only from the four tap counts. The user never sees the canonical representation, and the browser never receives the Argon2 hash.

## Argon2id usage

Enrollment and verification use the `argon2` library with the following configuration:

- memoryCost: `19456`
- timeCost: `2`
- parallelism: `1`
- type: `argon2id`

This server-side hash is used only as a verifier. Plaintext PINs and raw tap counts are never stored.

"Argon2id increases the cost of guessing but does not increase the entropy of the tactile secret."

## Security and data handling

The Factor 2 secret is intentionally a low-entropy knowledge factor and must remain paired with rate limiting, lockout/backoff, and Factor 1/WebAuthn. The four-digit PIN contains `10^4 = 10,000` possible combinations. The theoretical maximum entropy is `log2(10,000) ≈ 13.29 bits`.

The module stores:

- `userId`
- `schemeVersion` (`SB2`)
- `argon2idPhc`
- `expectedDigits` (`4`)

The module does not store:

- plaintext PINs
- raw tap counts
- canonical PIN strings in the browser
- full session state

## API

The public API exposes:

- `captureTapPattern`
- `canonicalizeShiftedPin`
- `hashPattern`
- `verifyPattern`
- `SpacebarSecretRepository`
- `InMemorySpacebarSecretRepository`
- `ShiftedPinPattern`
- `StoredSpacebarSecret`
- `VerifyPatternResult`

Capture is attached to a specific active element only. It ignores auto-repeat and prevents page scrolling while active.

## Integration boundaries

A successful Factor 2 verification is not a complete authentication. The system orchestrator must create a short-lived PartialAuthSession and subsequently require Factor 1/WebAuthn.

Hasini owns rate limiting, lockout, exponential backoff, and `LoginAttempt` auditing. The verifier remains independent and is called only after the rate limiter permits the attempt.

Sheneth owns the Accessibility Engine, live regions, and spoken announcements. This module exposes prompt callbacks but does not run speech synthesis or TTS logic.

## Assumptions

1. The device has a platform biometric authenticator, with a security-key fallback offered where required.
2. The browser supports WebAuthn Level 2 and ARIA live regions.
3. The user's device has a working keyboard with a spacebar and audio output. Where private audio feedback is required, headphones are assumed available.
4. Initial device/account binding occurs over an already authenticated session.
5. A separate recovery channel such as verified email exists and is assumed independently secured.
6. The system targets visual impairment specifically. It does not claim to accommodate motor impairments that prevent reliable spacebar operation.
7. No offline fallback is provided. Authentication requires a live server connection.
8. The prototype assumes a single-language interface and does not implement internationalization.
9. Argon2id parameters must be benchmarked against deployment hardware and reviewed periodically.
10. The user is familiar with the authentication procedure and knows the shifted PIN mapping:
    - 1 tap -> 0
    - 2 taps -> 1
    - 3 taps -> 2
    - 4 taps -> 3
    - 5 taps -> 4
    - 6 taps -> 5
    - 7 taps -> 6
    - 8 taps -> 7
    - 9 taps -> 8
    - 10 taps -> 9

The PIN contains exactly four digits.
=======
This package captures and verifies a spacebar tactile knowledge secret. It supports tap-count groups and short/long rhythm patterns. It returns only a Factor 2 verification result and never creates a session, WebAuthn challenge, credential, or authenticated session.

## Canonical formats

Count mode encodes groups as `SB1|COUNT|3,1,4,2`.

Rhythm mode compares adjacent timestamp gaps against configured threshold and tolerance and encodes only `S` and `L`, for example `SB1|RHYTHM|SLSLLSSL`. Ambiguous gaps fail validation. Raw timestamps are transient and are never persisted or included in canonical output.

## Hashing and storage

Enrollment hashes the canonical value with Argon2id using memory cost 19456 KiB, time cost 2, and parallelism 1. The `argon2` library generates a unique salt for every hash. Only the encoded PHC hash and non-secret mode metadata belong in `SpacebarSecret`; plaintext patterns and raw timestamps are excluded.

Argon2id increases the cost of guessing but does not increase the entropy of the tactile secret.

## API

The public API exports `captureTapPattern`, `canonicalizeCountPattern`, `canonicalizeRhythmPattern`, `hashPattern`, `verifyPattern`, `SpacebarSecretRepository`, the in-memory repository for tests, and the relevant public types. Capture is attached to one active element and exposes callbacks for taps, completed groups, ready patterns, reset, and validation errors. It ignores auto-repeat and prevents Space scrolling while active.

## Integration boundaries

After `verifyPattern` returns success, Senadi creates the short-lived `PartialAuthSession` and continues to Factor 1/WebAuthn. A successful Factor 2 verification is not a complete authentication. The system orchestrator must create a short-lived PartialAuthSession and subsequently require Factor 1/WebAuthn.

Hasini owns rate limiting, lockout, exponential backoff, and `LoginAttempt` logging. The verifier remains independent and should be called only after `rateLimiter.canAttempt(userId)`; the orchestrator then logs the result.

Sheneth owns ARIA live regions, screen-reader announcements, audio earcons, and the accessibility engine. This package does not expose or speak the tap counts, rhythm sequence, canonical secret, or raw tactile secret.
>>>>>>> 5382501e8c22ef80dc1321e6f6ccce8ea6408a50

## Development

```text
npm install
npm test
npm run build
<<<<<<< HEAD
npm run demo
```

Run these commands from `factor2-spacebar/`.

## Demo behavior

The local demo supports a single four-digit tactile PIN entry flow.

- click to activate the tactile PIN input
- Space increments the current digit's tap count
- Enter confirms the current digit
- Escape resets the entire PIN
- enrollment and verification remain disabled until four digits are captured
- the UI reports progress without revealing the raw digit values or canonical secret
=======
```

All commands must be run from `factor2-spacebar/`. `schema.sql` is a logical database contract only and must not be run as a shared-project migration.
>>>>>>> 5382501e8c22ef80dc1321e6f6ccce8ea6408a50
