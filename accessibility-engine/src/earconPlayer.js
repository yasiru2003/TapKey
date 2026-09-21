/** Short non-speech cues. Audio is opt-in and defaults to silent for privacy. */
export function createEarconPlayer({ AudioContextClass = globalThis.AudioContext, headphonesOnly = true } = {}) {
  let context;
  let enabled = false;
  let tapCount = 0;
  function tone(frequency, duration, delay = 0) {
    if (!enabled || (headphonesOnly && !headphonesConnected()) || !AudioContextClass) return false;
    context ||= new AudioContextClass();
    if (context.state === 'suspended') void context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + delay;
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.08, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
    return true;
  }
  // Browsers do not reliably expose headphone connection. The caller must
  // explicitly confirm a private output before enabling private-only audio.
  let privateOutputConfirmed = false;
  function headphonesConnected() { return privateOutputConfirmed; }
  return {
    setEnabled(value) { enabled = Boolean(value); },
    setPrivateOutputConfirmed(value) { privateOutputConfirmed = Boolean(value); },
    setHeadphonesOnly(value) { headphonesOnly = Boolean(value); },
    get enabled() { return enabled; },
    tap() { tapCount += 1; return tone(Math.min(400 + tapCount * 70, 1000), 0.08); },
    resetTapCount() { tapCount = 0; },
    success() { tone(520, 0.12); tone(780, 0.16, 0.14); },
    failure() { tone(360, 0.14); tone(240, 0.2, 0.16); },
    async destroy() { if (context) await context.close(); context = undefined; },
  };
}
