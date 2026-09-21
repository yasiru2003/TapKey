# Authentication API Contract

The server owns the login state machine. Factor modules provide verification ports; they do not create or promote sessions.

## Login sequence

| Endpoint | Request | Success response |
| --- | --- | --- |
| `POST /api/login/start` | `{ "userId": string }` | `{ "userId": string, "next": "FACTOR_2" }` |
| `POST /api/login/factor-2` | `{ "userId": string, "tapPattern": unknown }` | `{ "next": "FACTOR_1", "partialSession": PartialAuthSession, "partialSessionToken": string }` |
| `POST /api/login/factor-1` | `{ "userId": string, "partialSessionToken": string, "assertion": unknown }` | `{ "next": "AUTHENTICATED", "sessionToken": string, "expiresAt": string }` |

`factor-2` must return a verified result before the server creates a `PartialAuthSession`. The token is opaque to clients and is returned only after successful Factor 2 verification. The server stores only its SHA-256 hash.

Before calling Factor 1, the server validates the token against the requested user and current time. Factor 1 must also use the same `SessionGateValidator` behavior for direct endpoint calls, so bypassing the orchestrator cannot bypass Design D2.

After successful Factor 1 verification, the server issues the full session and consumes the partial session. A partial session is valid for five minutes, is single-use after promotion, and can be explicitly expired. Invalid, expired, consumed, or user-mismatched sessions return a rejected request and must not create a full session.

## Integration ports

- **Thashira / Factor 2:** implement `Factor2Verifier.verify({ userId, tapPattern })`.
- **Yasiru / Factor 1:** implement `Factor1Verifier.verify({ userId, partialSessionToken, assertion })`; its endpoint should accept the token as the D2 gate credential.
- **Session manager:** expose `validatePartialSession(token, userId)` by adapting `PartialAuthSessionStore.validate` to the Factor 1 package's `SessionGateValidator` interface.
- **Full session implementation:** implement `FullSessionIssuer.issue(userId)` and return the secure session cookie or token through the HTTP adapter, not from the Factor modules.