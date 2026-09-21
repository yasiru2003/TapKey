# Isolated integrated test UI

This connector uses the unchanged `temp_main` server, WebAuthn, and accessibility modules. Factor 2 in `temp_main` has unresolved merge markers, so the connector uses the unchanged clean `Thashira` worktree for Factor 2. No existing module source files are edited.

From the main TapKey checkout:

```sh
git fetch origin temp_main Thashira
git worktree add --detach /tmp/tapkey-tempmain-test origin/temp_main
git worktree add --detach /tmp/tapkey-factor2-clean origin/Thashira
cd /tmp/tapkey-tempmain-test/factor1-webauthn && npm ci && npm run build
cd /tmp/tapkey-factor2-clean/factor2-spacebar && npm ci && npm run build
cd /tmp/tapkey-tempmain-test
FACTOR2_ROOT=/tmp/tapkey-factor2-clean/factor2-spacebar node integration-ui/build-client.mjs
FACTOR2_ROOT=/tmp/tapkey-factor2-clean/factor2-spacebar ./factor1-webauthn/node_modules/.bin/tsx integration-ui/server.mjs
```

Open <http://localhost:5190/>. Enter a username, record four tap groups, enroll the pattern once, verify Factor 2, register a platform authenticator, then authenticate. All stored data is temporary and disappears when the server stops. A real screen reader and device biometric prompt are needed to assess spoken output and biometric interaction.
