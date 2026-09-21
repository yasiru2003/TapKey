/** Screen-reader announcements for login state changes. */
export function createLiveRegion(root = document.body) {
  const doc = root.ownerDocument || document;
  const region = doc.createElement('div');
  region.setAttribute('role', 'status');
  region.setAttribute('aria-live', 'polite');
  region.setAttribute('aria-atomic', 'true');
  region.className = 'tapkey-sr-only';
  root.appendChild(region);

  return {
    announce(message, { urgent = false } = {}) {
      if (typeof message !== 'string' || !message.trim()) return;
      region.setAttribute('role', urgent ? 'alert' : 'status');
      region.setAttribute('aria-live', urgent ? 'assertive' : 'polite');
      // Clearing first lets repeated server responses be announced again.
      region.textContent = '';
      region.textContent = message;
    },
    element: region,
    destroy() { region.remove(); },
  };
}

/** Maps protocol events and server responses to concise spoken messages. */
export function announceAuthState(liveRegion, state, detail = '') {
  const messages = {
    identity_acknowledged: 'Username received. Enter your spacebar secret.',
    pattern_ready: 'Spacebar pattern recorded. Press Enter to submit.',
    factor2_pending: 'Checking your spacebar secret.',
    factor2_success: 'Spacebar secret accepted. Continue with your device biometric prompt.',
    factor2_failure: 'Spacebar secret not accepted. Try again.',
    locked_out: 'Too many attempts. Please wait before trying again.',
    biometric_pending: 'Follow your device biometric prompt.',
    biometric_cancelled: 'Biometric prompt cancelled.',
    biometric_failure: 'Biometric verification failed. Try again.',
    authenticated: 'Login successful.',
    error: 'An error occurred. Please try again.',
  };
  const message = detail || messages[state];
  if (!message) throw new RangeError(`Unknown authentication state: ${state}`);
  liveRegion.announce(message, { urgent: ['factor2_failure', 'locked_out', 'biometric_failure', 'error'].includes(state) });
}
