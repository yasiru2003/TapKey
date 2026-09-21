# Factor 2 - Spacebar Tactile Knowledge Secret

Owner: W.G.T. Devindu - 230134U

## Scope

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

## Development

```text
npm install
npm test
npm run build
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
