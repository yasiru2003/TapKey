# Accessibility engine

Browser-side helpers owned by Sheneth. Import from `@tapkey/accessibility-engine` or `src/index.js`.

Load `src/liveRegion.css` in the page and create one live region on page load. Call `announceAuthState(region, state)` for **every** server response and authentication transition, including errors and lockout. Use `region.announce(message, { urgent: true })` for additional server messages. Screen readers speak the text through ARIA; no custom speech synthesis is used.

The earcon player starts muted. For private audio, confirm headphones with the user, then call `setPrivateOutputConfirmed(true)` and `setEnabled(true)`. Browsers cannot reliably detect headphones, so the toggle is an explicit user choice. Call `tap()`, `success()`, or `failure()` alongside the corresponding live announcement. Audio never replaces ARIA.

Attach `createKeyHandler({ target, onSpace, onSubmit, onCancel })` to a dedicated tap area. It ignores editable controls, button keys, key repeats, and modified keys. `onSpace` should pass the event to Factor 2's `captureTapPattern`; this module does not interpret or verify the secret.

Run `npm test` for unit tests. Run `npm run test:browser` for the Chrome flow covering username response, Space/Enter/Escape, privacy-gated tones, Factor 2 outcomes, biometric prompt, and final success. The browser test checks DOM behavior and audio scheduling; actual screen-reader speech and hardware output still require a manual device check.
