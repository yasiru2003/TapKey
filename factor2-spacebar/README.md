# Factor 2 - Spacebar Tactile Knowledge Secret

Owner: W.G.T. Devindu - 230134U

## Scope

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

## Development

```text
npm install
npm test
npm run build
```

All commands must be run from `factor2-spacebar/`. `schema.sql` is a logical database contract only and must not be run as a shared-project migration.