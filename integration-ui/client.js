import { createLiveRegion, announceAuthState, createEarconPlayer } from '/a11y/index.js';
import { captureTapPattern } from '/factor2-capture.js';

const region = createLiveRegion();
const audio = createEarconPlayer();
const $ = (selector) => document.querySelector(selector);
let userId = '';
let pattern;
let token = '';
let groups = [];
const status = $('#status');
function report(state, detail = '', sound) {
  announceAuthState(region, state, detail);
  status.textContent = region.element.textContent;
  if (sound) audio[sound]();
}
async function post(route, data) {
  const response = await fetch(route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Request failed');
  return result;
}
function getUser() {
  const typed = $('#username').value.trim();
  if (!typed) throw new Error('Enter a username first');
  if (userId && userId !== typed) { token = ''; pattern = undefined; capture.reset(); }
  userId = typed;
  return userId;
}
const capture = captureTapPattern($('#capture'), {
  mode: 'COUNT',
  onTap: () => { audio.tap(); $('#progress').textContent = `${groups.length + 1} of 4 groups: tapping`; },
  onGroupCompleted: (next) => { groups = next; $('#progress').textContent = `${Math.min(groups.length, 4)} of 4 groups recorded`; audio.resetTapCount(); },
  onPatternReady: (candidate) => {
    if (candidate.groups.length === 4) { pattern = candidate; report('pattern_ready'); }
    if (candidate.groups.length > 4) { capture.reset(); report('error', 'Four groups maximum. Pattern reset.', 'failure'); }
  },
  onReset: () => { groups = []; pattern = undefined; $('#progress').textContent = '0 of 4 groups recorded'; report('biometric_cancelled', 'Pattern reset.'); },
  onValidationError: (error) => report('error', error.message, 'failure'),
});
$('#private-output').addEventListener('change', (event) => audio.setPrivateOutputConfirmed(event.target.checked));
$('#audio-enabled').addEventListener('change', (event) => audio.setEnabled(event.target.checked));
$('#start').addEventListener('click', async () => {
  try { const id = getUser(); await post('/api/login/start', { userId: id }); report('identity_acknowledged'); }
  catch (error) { report('error', error.message, 'failure'); }
});
$('#enroll').addEventListener('click', async () => {
  try { const id = getUser(); const result = await post('/api/enroll/spacebar', { userId: id, pattern }); if (result.enrolled) report('pattern_ready', 'Spacebar secret enrolled. You can now verify it.', 'success'); }
  catch (error) { report('error', error.message, 'failure'); }
});
$('#verify').addEventListener('click', async () => {
  try {
    const id = getUser(); report('factor2_pending');
    const result = await post('/api/login/factor2', { userId: id, pattern });
    token = result.partialSessionToken;
    report('factor2_success', '', 'success');
  } catch (error) { report('factor2_failure', error.message, 'failure'); }
});
$('#register').addEventListener('click', async () => {
  try {
    const id = getUser();
    const options = await post('/api/webauthn/register/options', { userId: id, token });
    report('biometric_pending');
    const response = await window.SimpleWebAuthnBrowser.startRegistration({ optionsJSON: options });
    await post('/api/webauthn/register/verify', { userId: id, token, response });
    report('biometric_pending', 'Device registered. Select Authenticate to finish.');
  } catch (error) { report('biometric_failure', error.message, 'failure'); }
});
$('#authenticate').addEventListener('click', async () => {
  try {
    const id = getUser();
    const options = await post('/api/webauthn/auth/options', { userId: id, token });
    report('biometric_pending');
    const response = await window.SimpleWebAuthnBrowser.startAuthentication({ optionsJSON: options });
    const result = await post('/api/webauthn/auth/verify', { userId: id, token, response });
    if (result.next !== 'AUTHENTICATED') throw new Error('Authentication did not complete');
    token = '';
    report('authenticated', '', 'success');
  } catch (error) { report('biometric_failure', error.message, 'failure'); }
});
