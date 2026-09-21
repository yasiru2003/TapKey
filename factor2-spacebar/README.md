# Factor 2 - Spacebar Tactile Knowledge Secret

**Owner**: W.G.T. Devindu (`230134U`)

## Scope

This Factor 2 module captures and verifies a spacebar tactile knowledge secret. It supports:
1. **Four-digit shifted PIN mode (`SB2|PIN`)**: Each digit is entered by pressing Space between 1 and 10 times (1 tap = 0, 2 taps = 1, ..., 10 taps = 9).
2. **Tap-count groups (`SB1|COUNT`)**: Multi-group tap counts.
3. **Cadence rhythm mode (`SB1|RHYTHM`)**: Millisecond timestamp gaps categorized into Short (`S`) and Long (`L`) cadence intervals against configured threshold and tolerance.

The module hashes the canonical representations with **Argon2id** and reports only `PASS` / `FAIL` verification results. It never creates a full session or WebAuthn challenge.

## Canonical Formats

* **Shifted PIN Mode**: `SB2|PIN|5072`
* **Count Group Mode**: `SB1|COUNT|3,1,4,2`
* **Cadence Rhythm Mode**: `SB1|RHYTHM|SLSLLSSL`

Plaintext secrets and raw timestamps are transient and never stored or returned to the browser.

## Argon2id Configuration

Enrollment and verification use standard Argon2id hashing:
* Memory cost: `19456` KiB (19 MiB)
* Time cost: `2` iterations
* Parallelism: `1` lane
* Type: `argon2id`

> *"Argon2id increases the cost of guessing but does not increase the entropy of the tactile secret."*

## Security and Data Handling

The Factor 2 secret is intentionally a low-entropy knowledge factor and must remain strictly paired with rate limiting, lockout/backoff (Hasini / Security Module), and Factor 1 WebAuthn / FIDO2 biometric gates.

The module stores:
* `userId`
* `schemeVersion` (`SB1` or `SB2`)
* `argon2idPhc`
* Metadata (`mode`, `expectedUnits`, `expectedDigits`, `thresholdMs`, `toleranceMs`)

The module never stores:
* Plaintext PINs or counts
* Raw millisecond timestamp arrays
* Full session tokens

## Development & Testing

```bash
cd factor2-spacebar
npm install
npm test
npm run build
npm run demo
```
