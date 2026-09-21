/**
 * TapKey Unified Frontend Application & State Manager
 */

// ==========================================
// 1. Synthesized Audio Earcon Engine
// ==========================================
class EarconSynthesizer {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(frequency, durationMs = 80, type = 'sine', gainVal = 0.15) {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);

      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + durationMs / 1000);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + durationMs / 1000);
    } catch (e) {
      console.warn('Audio tone failed', e);
    }
  }

  tapSound(count) {
    const baseFreq = 400 + Math.min(count, 10) * 45;
    this.playTone(baseFreq, 60, 'sine', 0.2);
  }

  digitConfirmedSound() {
    this.playTone(700, 100, 'triangle', 0.2);
    setTimeout(() => this.playTone(950, 120, 'triangle', 0.2), 90);
  }

  gateUnlockedSound() {
    this.playTone(520, 120, 'sine', 0.2);
    setTimeout(() => this.playTone(659, 140, 'sine', 0.2), 100);
    setTimeout(() => this.playTone(784, 180, 'sine', 0.2), 220);
  }

  successSound() {
    this.playTone(523.25, 120, 'sine', 0.2);
    setTimeout(() => this.playTone(659.25, 140, 'sine', 0.2), 120);
    setTimeout(() => this.playTone(783.99, 160, 'sine', 0.2), 240);
    setTimeout(() => this.playTone(1046.5, 260, 'sine', 0.25), 360);
  }

  errorSound() {
    this.playTone(220, 150, 'sawtooth', 0.2);
    setTimeout(() => this.playTone(180, 200, 'sawtooth', 0.2), 120);
  }

  resetSound() {
    this.playTone(300, 100, 'sine', 0.15);
    setTimeout(() => this.playTone(200, 120, 'sine', 0.15), 80);
  }
}

// ==========================================
// 1.5 Spoken Text-To-Speech (TTS) Engine for Blind Users
// ==========================================
class TextToSpeechEngine {
  constructor() {
    this.enabled = true; // Active by default for eyes-free accessibility
    this.synth = window.speechSynthesis || null;
    this.voice = null;
    this.unlocked = false;
    this.initVoices();
    this.bindAutoUnlock();
  }

  initVoices() {
    if (!this.synth) return;
    const pickVoice = () => {
      const voices = this.synth.getVoices();
      if (!voices || voices.length === 0) return;
      this.voice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Samantha') || v.name.includes('Natural') || v.name.includes('Google') || v.default)) || voices[0];
    };
    pickVoice();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = pickVoice;
    }
  }

  bindAutoUnlock() {
    const unlock = () => {
      this.unlock();
    };
    window.addEventListener('click', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
  }

  unlock() {
    if (!this.synth) return;
    if (this.synth.paused) {
      this.synth.resume();
    }
    this.unlocked = true;
  }

  speak(text, cancelCurrent = true) {
    if (!this.enabled || !this.synth || !text) return;
    try {
      this.unlock();
      if (cancelCurrent) {
        this.synth.cancel();
      }

      // Format text for natural spoken pronunciation
      const clean = text
        .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[✓○⏳⌨️🪪🔇🔊👁️🗣️🎤🔴→—]/gu, '')
        .replace(/\bD1\b/g, 'Digit 1')
        .replace(/\bD2\b/g, 'Digit 2')
        .replace(/\bD3\b/g, 'Digit 3')
        .replace(/\bD4\b/g, 'Digit 4')
        .trim();

      if (!clean) return;

      if (!this.voice) {
        this.initVoices();
      }

      const utterance = new SpeechSynthesisUtterance(clean);
      if (this.voice) utterance.voice = this.voice;
      utterance.lang = 'en-US';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onerror = (e) => {
        if (e.error !== 'canceled') {
          console.warn('TTS utterance error', e);
        }
      };

      this.synth.speak(utterance);
    } catch (e) {
      console.warn('TTS speech exception', e);
    }
  }
}

// ==========================================
// 1.8 Voice Input Engine (Speech Recognition & Spoken Confirmation)
// ==========================================
class VoiceInputEngine {
  constructor(app) {
    this.app = app;
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition || null;
    this.recognition = SpeechRec ? new SpeechRec() : null;
    this.isListening = false;
    this.activeInputId = null;
    this.activeFlow = null;
    this.init();
  }

  init() {
    if (!this.recognition) return;
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      this.isListening = true;
      this.updateMicButtons(true);
      this.showVoiceStatus('🎙️ Listening... Speak your username or name clearly now.', 'info');
    };

    this.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim();
      this.handleVoiceResult(transcript);
    };

    this.recognition.onerror = (event) => {
      console.warn('Voice input error', event.error);
      this.isListening = false;
      this.updateMicButtons(false);
      this.showVoiceStatus(`Voice input error (${event.error}). Please click microphone to retry or type directly.`, 'error');
      this.app.announce('Voice input error. Please click microphone to retry.');
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.updateMicButtons(false);
    };
  }

  start(targetInputId, flowType) {
    if (!this.recognition) {
      this.app.announce('Speech recognition is not supported in this browser. Please type into the input field.', 'assertive');
      alert('Speech recognition is not supported by this browser. Recommended browsers: Google Chrome, Microsoft Edge, or Safari.');
      return;
    }

    this.activeInputId = targetInputId;
    this.activeFlow = flowType;

    const input = document.getElementById(targetInputId);
    if (input) input.focus();

    try {
      this.app.earcon.init();
      if (this.app.tts) this.app.tts.unlock();
      this.recognition.start();
      this.app.announce('Listening for voice input. Speak now.');
    } catch (e) {
      console.warn('Voice recognition start failed', e);
    }
  }

  stop() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }

  handleVoiceResult(rawText) {
    const input = document.getElementById(this.activeInputId);
    if (!input) return;

    let processed = rawText;
    if (this.activeInputId.includes('username') || this.activeInputId.includes('user')) {
      // Convert spoken username: lowercase, remove spaces, handle 'underscore' or numbers
      processed = rawText
        .toLowerCase()
        .replace(/\s+underscore\s+/g, '_')
        .replace(/\s+dot\s+/g, '.')
        .replace(/\s+dash\s+/g, '-')
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9_.-]/g, '');
    }

    input.value = processed;
    input.dispatchEvent(new Event('input', { bubbles: true }));

    // Spell out letters for blind confirmation (e.g. Y - A - S - I - R - U - 2 - 0 - 0 - 3)
    const spelled = processed.split('').join(' - ');
    const isDisplayName = this.activeInputId.includes('name') && !this.activeInputId.includes('user');
    const label = isDisplayName ? 'Display Name' : 'Username';

    this.showVoiceStatus(`✓ Captured ${label}: <strong>${processed}</strong> (Press Enter to continue)`, 'success');
    this.app.earcon.successSound();

    // Spoken Text-by-Text Voice Confirmation
    const confirmPrompt = `Captured ${label}: ${spelled}. Press Enter to proceed, or click microphone to change.`;
    this.app.announce(confirmPrompt, 'assertive');
  }

  updateMicButtons(listening) {
    document.querySelectorAll('.btn-voice').forEach((btn) => {
      const textSpan = btn.querySelector('.voice-btn-text');
      if (listening && btn.id.includes(this.activeInputId ? this.activeInputId.replace('login-', '').replace('reg-', '') : '')) {
        btn.classList.add('listening');
        if (textSpan) textSpan.textContent = 'Listening...';
      } else {
        btn.classList.remove('listening');
        if (textSpan) textSpan.textContent = 'Voice Input';
      }
    });
  }

  showVoiceStatus(htmlMsg, type = 'info') {
    const statusMap = {
      'login-username': 'voice-status-login',
      'reg-username': 'voice-status-reg-user',
      'reg-display-name': 'voice-status-reg-name',
    };
    const targetStatusId = statusMap[this.activeInputId];
    if (targetStatusId) {
      const el = document.getElementById(targetStatusId);
      if (el) {
        el.innerHTML = htmlMsg;
        el.className = `voice-status-msg ${type}`;
        el.classList.remove('hidden');
      }
    }
  }
}

// ==========================================
// 2. Application State Controller
// ==========================================
class TapKeyApp {
  constructor() {
    this.earcon = new EarconSynthesizer();
    this.tts = new TextToSpeechEngine();
    this.voiceInput = new VoiceInputEngine(this);
    this.state = {
      currentPage: 'login',
      currentUser: null,
      sessionToken: null,

      // Registration Flow State
      reg: {
        step: 1,
        userId: null,
        username: null,
        displayName: null,
        digits: [],
        currentTapCount: 0,
        digitIndex: 0,
        isBlocked: false,
      },

      // Login Flow State
      login: {
        step: 1,
        userId: null,
        username: null,
        displayName: null,
        digits: [],
        currentTapCount: 0,
        digitIndex: 0,
        isBlocked: false,
        partialSessionToken: null,
        gateExpiresAt: null,
        gateTimerInterval: null,
      },
    };

    this.PIN_PROMPTS = [
      'Enter first digit. Tap Spacebar, then Enter.',
      'First digit saved. Enter second digit.',
      'Second digit saved. Enter third digit.',
      'Third digit saved. Enter fourth digit.',
      'All four digits entered. Ready to proceed.',
    ];
  }

  init() {
    this.bindGlobalEvents();
    this.initTtsToggle();
    this.initAudioToggle();
    this.initContrastToggle();
    this.initTactileKeyHandlers();
    this.checkCurrentSession();
    this.handleHashChange();
    window.addEventListener('hashchange', () => this.handleHashChange());
  }

  startVoiceInput(targetInputId, flowType) {
    if (this.voiceInput) {
      this.voiceInput.start(targetInputId, flowType);
    }
  }

  // --- Voice and ARIA Screen Reader Announcer ---
  announce(message, priority = 'polite') {
    const regionId = priority === 'assertive' ? 'aria-live-assertive' : 'aria-live-polite';
    const el = document.getElementById(regionId);
    if (el) {
      el.textContent = '';
      setTimeout(() => { el.textContent = message; }, 50);
    }
    // Speak aloud using native browser speech synthesis
    if (this.tts) {
      this.tts.speak(message, true);
    }
  }

  // --- TTS Spoken Voice Toggle ---
  initTtsToggle() {
    const btn = document.getElementById('tts-toggle');
    const icon = document.getElementById('tts-icon');
    if (btn) {
      btn.addEventListener('click', () => {
        this.tts.enabled = !this.tts.enabled;
        btn.classList.toggle('active', this.tts.enabled);
        if (icon) icon.textContent = this.tts.enabled ? '🗣️' : '🤐';
        if (this.tts.enabled) {
          this.announce('Voice reader enabled');
        } else {
          if (this.tts.synth) this.tts.synth.cancel();
          const live = document.getElementById('aria-live-polite');
          if (live) live.textContent = 'Voice reader muted';
        }
      });
    }
  }

  // --- Audio Feedback & Mode Toggles ---
  initAudioToggle() {
    const btn = document.getElementById('audio-toggle');
    const icon = document.getElementById('audio-icon');
    if (btn) {
      btn.addEventListener('click', () => {
        this.earcon.muted = !this.earcon.muted;
        icon.textContent = this.earcon.muted ? '🔇' : '🔊';
        this.announce(this.earcon.muted ? 'Audio earcons muted' : 'Audio earcons enabled');
      });
    }
  }

  initContrastToggle() {
    const btn = document.getElementById('contrast-toggle');
    if (btn) {
      btn.addEventListener('click', () => {
        document.body.classList.toggle('high-contrast');
        const isHc = document.body.classList.contains('high-contrast');
        this.announce(isHc ? 'High contrast mode on' : 'High contrast mode off');
      });
    }
  }

  // --- Session-Based View and Navbar State Manager ---
  updateAuthUI(isLoggedIn, user = null) {
    const navLogin = document.getElementById('nav-login');
    const navReg = document.getElementById('nav-register');
    const navDash = document.getElementById('nav-dashboard');
    const userBadge = document.getElementById('header-user-badge');
    const userAvatar = document.getElementById('header-user-avatar');
    const userName = document.getElementById('header-user-name');

    if (isLoggedIn && user) {
      // HIDE login and register pages completely when user is authenticated
      if (navLogin) navLogin.classList.add('hidden');
      if (navReg) navReg.classList.add('hidden');
      if (navDash) navDash.classList.remove('hidden');

      if (userBadge) {
        userBadge.classList.remove('hidden');
        if (userAvatar) userAvatar.textContent = (user.displayName || user.username || 'U').charAt(0).toUpperCase();
        if (userName) userName.textContent = user.displayName || user.username;
      }
    } else {
      // SHOW login and register pages when logged out or session expired
      if (navLogin) navLogin.classList.remove('hidden');
      if (navReg) navReg.classList.remove('hidden');
      if (navDash) navDash.classList.add('hidden');
      if (userBadge) userBadge.classList.add('hidden');
    }
  }

  // --- Router & Navigation with Auth Guards ---
  handleHashChange() {
    const hash = window.location.hash.replace(/^#\/?/, '').trim();
    if (['login', 'register', 'dashboard', 'logs'].includes(hash)) {
      this.navigate(hash, false);
    }
  }

  navigate(pageName, updateHash = true) {
    // Auth Guard: If logged in, hide/block login and register pages until logout
    if (this.state.currentUser && (pageName === 'login' || pageName === 'register')) {
      pageName = 'dashboard';
    } else if (!this.state.currentUser && pageName === 'dashboard') {
      pageName = 'login';
    }

    this.state.currentPage = pageName;
    if (updateHash) {
      window.location.hash = `#/${pageName}`;
    }

    document.querySelectorAll('.nav-btn').forEach((btn) => btn.classList.remove('active'));
    const activeNav = document.getElementById(`nav-${pageName}`);
    if (activeNav) activeNav.classList.add('active');

    document.querySelectorAll('.page-view').forEach((view) => view.classList.remove('active'));
    const activeView = document.getElementById(`page-${pageName}`);
    if (activeView) activeView.classList.add('active');

    if (pageName === 'dashboard') {
      this.loadDashboard();
      this.announce('Authenticated Dashboard. View your security credentials and telemetry.');
    } else if (pageName === 'logs') {
      this.loadLogs();
      this.announce('Security Telemetry Monitor. Live audit logs stream.');
    } else if (pageName === 'login') {
      if (!this.state.login.partialSessionToken) {
        this.setLoginStep(1);
      }
      this.announce('Welcome to TapKey. Enter or speak your username to begin.');
    } else if (pageName === 'register') {
      if (this.state.reg.step !== 2) {
        this.setRegStep(1);
      }
      this.announce('Create Account. Enter or speak your username and display name.');
    } else {
      this.announce(`Navigated to ${pageName} page`);
    }
  }

  // ==========================================
  // 3. Tactile Keyboard Engine (Space, Enter, Esc)
  // ==========================================
  // ==========================================
  // 3. Tactile Keyboard Engine (Space, Enter, Esc, and Direct Pad Tap)
  // ==========================================
  recordTactileTap(prefix) {
    const isLogin = prefix === 'login';
    const flow = isLogin ? this.state.login : this.state.reg;
    const pad = document.getElementById(`${prefix}-capture-area`);

    this.earcon.init();
    if (pad && document.activeElement !== pad) {
      pad.focus();
    }

    if (flow.digits.length >= 4) {
      this.announce('All 4 digits already captured. Press Enter or click Verify.');
      return;
    }

    if (flow.isBlocked) {
      // Auto-unblock if reset needed
      flow.isBlocked = false;
      flow.currentTapCount = 0;
      this.hideError(`${prefix}-f2-error`);
    }

    flow.currentTapCount += 1;
    this.earcon.tapSound(flow.currentTapCount);
    this.createRipple(pad);

    if (flow.currentTapCount > 10) {
      flow.isBlocked = true;
      flow.currentTapCount = 0;
      this.earcon.errorSound();
      this.showError(`${prefix}-f2-error`, 'Maximum 10 taps per digit. Press Escape or Reset to start over.');
      this.announce('Maximum 10 taps exceeded. Press Escape to reset.', 'assertive');
      return;
    }

    this.updateDigitDots(prefix, flow.digitIndex, flow.currentTapCount);
    const statusEl = document.getElementById(`${prefix}-pad-status`);
    if (statusEl) {
      statusEl.textContent = `Digit ${flow.digitIndex + 1}: ${flow.currentTapCount} tap${flow.currentTapCount > 1 ? 's' : ''} recorded`;
    }
  }

  confirmTactileDigit(prefix) {
    const isLogin = prefix === 'login';
    const flow = isLogin ? this.state.login : this.state.reg;
    const pad = document.getElementById(`${prefix}-capture-area`);

    if (flow.digits.length >= 4) {
      // If already captured 4 digits, Enter proceeds to verification
      if (isLogin) this.submitLoginFactor2();
      else this.submitRegisterFactor2();
      return;
    }

    if (flow.isBlocked) {
      this.earcon.errorSound();
      this.showError(`${prefix}-f2-error`, 'Input blocked. Press Escape to reset.');
      return;
    }

    if (flow.currentTapCount < 1 || flow.currentTapCount > 10) {
      this.earcon.errorSound();
      this.showError(`${prefix}-f2-error`, 'Please tap Spacebar or click the pad between 1 and 10 times before confirming.');
      this.announce('Digit not entered. Tap Spacebar first.', 'assertive');
      return;
    }

    flow.digits.push(flow.currentTapCount);
    this.markDigitRecorded(prefix, flow.digitIndex, flow.currentTapCount);
    this.earcon.digitConfirmedSound();

    flow.currentTapCount = 0;
    flow.digitIndex += 1;

    if (flow.digits.length < 4) {
      this.setDigitActive(prefix, flow.digitIndex);
      const prompt = this.PIN_PROMPTS[flow.digitIndex];
      const promptEl = document.getElementById(`f2-${prefix}-prompt`);
      if (promptEl) promptEl.textContent = prompt;
      const statusEl = document.getElementById(`${prefix}-pad-status`);
      if (statusEl) statusEl.textContent = `Enter digit ${flow.digitIndex + 1} (Tap Spacebar, then Enter)`;
      this.announce(prompt);
    } else {
      // 4 digits completed
      const verifyBtn = document.getElementById(isLogin ? 'btn-login-f2-verify' : 'btn-reg-f2-save');
      if (verifyBtn) verifyBtn.disabled = false;

      const promptEl = document.getElementById(`f2-${prefix}-prompt`);
      if (promptEl) promptEl.textContent = 'All 4 digits captured! Press Enter or click button to proceed.';
      const statusEl = document.getElementById(`${prefix}-pad-status`);
      if (statusEl) statusEl.textContent = '✓ 4 digits ready for verification (Press Enter)';
      this.announce('Four digits captured. Ready to submit.');
    }
  }

  initTactileKeyHandlers() {
    const loginPad = document.getElementById('login-capture-area');
    const regPad = document.getElementById('reg-capture-area');

    const handleKey = (e, prefix) => {
      if (e.repeat) return;
      if (!['Space', 'Enter', 'Escape'].includes(e.code)) return;

      e.preventDefault();

      if (e.code === 'Space') {
        this.recordTactileTap(prefix);
      } else if (e.code === 'Enter') {
        this.confirmTactileDigit(prefix);
      } else if (e.code === 'Escape') {
        if (prefix === 'login') this.resetLoginCapture();
        else this.resetRegCapture();
        this.earcon.resetSound();
        this.announce('PIN input reset');
      }
    };

    // Global Key Listener: Intercepts Space/Enter/Escape whenever user is on Step 2
    window.addEventListener('keydown', (e) => {
      // Only ignore if user is actively typing in a visible input within an active step
      const activeEl = document.activeElement;
      if (activeEl && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName) && activeEl.type !== 'button') {
        const isVisibleInput = activeEl.offsetParent !== null && !!activeEl.closest('.step-pane.active');
        if (isVisibleInput) {
          return;
        }
      }

      const isRegActive = document.getElementById('page-register')?.classList.contains('active') || this.state.currentPage === 'register';
      const isLoginActive = document.getElementById('page-login')?.classList.contains('active') || this.state.currentPage === 'login';

      const isRegStep2 = isRegActive && (this.state.reg.step === 2 || document.getElementById('reg-step-2')?.classList.contains('active'));
      const isLoginStep2 = isLoginActive && (this.state.login.step === 2 || document.getElementById('login-step-2')?.classList.contains('active'));

      if (isRegStep2) {
        handleKey(e, 'reg');
      } else if (isLoginStep2) {
        handleKey(e, 'login');
      }
    });

    // Pad Click Listeners: Clicking the pad records a tap directly and keeps focus
    if (loginPad) {
      loginPad.addEventListener('click', (e) => {
        e.preventDefault();
        this.recordTactileTap('login');
      });
    }

    if (regPad) {
      regPad.addEventListener('click', (e) => {
        e.preventDefault();
        this.recordTactileTap('reg');
      });
    }
  }

  createRipple(element) {
    if (!element) return;
    const ripple = document.createElement('span');
    ripple.className = 'pad-ripple';
    element.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  }

  updateDigitDots(prefix, index, count) {
    const dotEl = document.getElementById(`${prefix}-dots-${index + 1}`);
    if (dotEl) {
      dotEl.textContent = `${count} tap${count > 1 ? 's' : ''}`;
    }
  }

  setDigitActive(prefix, index) {
    for (let i = 1; i <= 4; i++) {
      const box = document.getElementById(`${prefix}-d${i}`);
      if (box) box.classList.remove('active');
    }
    const target = document.getElementById(`${prefix}-d${index + 1}`);
    if (target) target.classList.add('active');
  }

  markDigitRecorded(prefix, index, count) {
    const box = document.getElementById(`${prefix}-d${index + 1}`);
    if (box) {
      box.classList.remove('active');
      box.classList.add('recorded');
    }
    const dotEl = document.getElementById(`${prefix}-dots-${index + 1}`);
    if (dotEl) {
      dotEl.textContent = `✓ (${count})`;
    }
  }

  resetDigitIndicators(prefix) {
    for (let i = 1; i <= 4; i++) {
      const box = document.getElementById(`${prefix}-d${i}`);
      if (box) {
        box.classList.remove('active', 'recorded');
      }
      const dotEl = document.getElementById(`${prefix}-dots-${i}`);
      if (dotEl) dotEl.textContent = '○';
    }
    this.setDigitActive(prefix, 0);
  }

  // ==========================================
  // 4. Registration Flow Handler
  // ==========================================
  async handleRegisterStart(event) {
    event.preventDefault();
    this.hideError('reg-start-error');
    const username = document.getElementById('reg-username').value.trim();
    const displayName = document.getElementById('reg-display-name').value.trim();

    try {
      const res = await fetch('/api/register/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, displayName }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Registration start failed.');
      }

      this.state.reg.userId = data.user.id;
      this.state.reg.username = data.user.username;
      this.state.reg.displayName = data.user.displayName;

      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }

      this.setRegStep(2);
      this.resetRegCapture();
      this.announce('Account initialized. Now setup your Factor 2 spacebar tactile secret.');
    } catch (err) {
      this.showError('reg-start-error', err.message);
      this.earcon.errorSound();
    }
  }

  resetRegCapture() {
    this.state.reg.digits = [];
    this.state.reg.currentTapCount = 0;
    this.state.reg.digitIndex = 0;
    this.state.reg.isBlocked = false;

    this.resetDigitIndicators('reg');
    this.hideError('reg-f2-error');

    const btn = document.getElementById('btn-reg-f2-save');
    if (btn) btn.disabled = true;

    const statusEl = document.getElementById('reg-pad-status');
    if (statusEl) statusEl.textContent = 'Click pad or press Spacebar to tap (1-10)';

    const promptEl = document.getElementById('f2-reg-prompt');
    if (promptEl) promptEl.textContent = this.PIN_PROMPTS[0];

    const pad = document.getElementById('reg-capture-area');
    if (pad) {
      pad.focus();
      pad.classList.add('focused');
    }
  }

  async submitRegisterFactor2() {
    this.hideError('reg-f2-error');
    const { userId, digits } = this.state.reg;

    if (digits.length !== 4) {
      this.showError('reg-f2-error', 'Please enter exactly 4 digits.');
      return;
    }

    try {
      const res = await fetch('/api/register/factor2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          candidate: { tapCounts: digits },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Factor 2 registration failed');
      }

      this.earcon.successSound();
      this.setRegStep(3);
      this.announce('Factor 2 spacebar secret enrolled with Argon2id. Next, register WebAuthn biometric.');
    } catch (err) {
      this.showError('reg-f2-error', err.message);
      this.earcon.errorSound();
    }
  }

  async startWebAuthnRegistration() {
    this.hideError('reg-f1-error');
    const statusMsg = document.getElementById('reg-f1-status-msg');
    const { userId } = this.state.reg;

    try {
      statusMsg.textContent = 'Requesting Relying Party challenge...';
      const optRes = await fetch('/api/register/webauthn/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const options = await optRes.json();
      if (!optRes.ok) throw new Error(options.error || 'Could not fetch WebAuthn challenge');

      statusMsg.textContent = 'Please complete the biometric / passkey gesture...';
      this.announce('Touch your biometric sensor or insert hardware security key.');

      // SimpleWebAuthn browser ceremony trigger
      const attResp = await SimpleWebAuthnBrowser.startRegistration({ optionsJSON: options });

      statusMsg.textContent = 'Verifying cryptographic attestation on server...';
      const verifyRes = await fetch('/api/register/webauthn/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, response: attResp }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.success) {
        throw new Error(verifyData.error || 'WebAuthn verification failed');
      }

      this.earcon.successSound();
      this.setRegStep(4);
      this.announce('Registration completed successfully! Your 2FA credentials are fully enrolled.');
    } catch (err) {
      statusMsg.textContent = 'Registration failed.';
      this.showError('reg-f1-error', err.message);
      this.earcon.errorSound();
    }
  }

  setRegStep(stepNum) {
    this.state.reg.step = stepNum;
    for (let i = 1; i <= 4; i++) {
      const pane = document.getElementById(`reg-step-${i}`);
      const node = document.getElementById(`reg-stepnode-${i}`);
      const line = document.getElementById(`reg-stepline-${i}`);

      if (pane) pane.classList.toggle('active', i === stepNum);
      if (node) {
        node.classList.toggle('active', i === stepNum);
        node.classList.toggle('completed', i < stepNum);
      }
      if (line) line.classList.toggle('active', i < stepNum);
    }
    if (stepNum === 2) {
      setTimeout(() => {
        const pad = document.getElementById('reg-capture-area');
        if (pad) {
          pad.focus();
          pad.classList.add('focused');
        }
      }, 60);
    }
  }

  // ==========================================
  // 5. Login Flow (Reverse 2FA Sequence)
  // ==========================================
  async handleLoginStart(event) {
    event.preventDefault();
    this.hideError('login-start-error');
    const username = document.getElementById('login-username').value.trim();

    try {
      const res = await fetch('/api/login/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Login start failed.');
      }

      this.state.login.userId = data.userId;
      this.state.login.username = data.username;
      this.state.login.displayName = data.displayName;

      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }

      this.setLoginStep(2);
      this.resetLoginCapture();
      this.announce(`Identity confirmed for ${data.displayName}. Enter Factor 2 spacebar tactile secret.`);
    } catch (err) {
      this.showError('login-start-error', err.message);
      this.earcon.errorSound();
    }
  }

  resetLoginCapture() {
    this.state.login.digits = [];
    this.state.login.currentTapCount = 0;
    this.state.login.digitIndex = 0;
    this.state.login.isBlocked = false;

    this.resetDigitIndicators('login');
    this.hideError('login-f2-error');

    const btn = document.getElementById('btn-login-f2-verify');
    if (btn) btn.disabled = true;

    const statusEl = document.getElementById('login-pad-status');
    if (statusEl) statusEl.textContent = 'Click pad or press Spacebar to tap (1-10)';

    const promptEl = document.getElementById('f2-login-prompt');
    if (promptEl) promptEl.textContent = this.PIN_PROMPTS[0];

    const pad = document.getElementById('login-capture-area');
    if (pad) {
      pad.focus();
      pad.classList.add('focused');
    }
  }

  async submitLoginFactor2() {
    this.hideError('login-f2-error');
    const { userId, digits } = this.state.login;

    if (digits.length !== 4) {
      this.showError('login-f2-error', 'Please enter exactly 4 digits.');
      return;
    }

    try {
      const res = await fetch('/api/login/factor2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          candidate: { tapCounts: digits },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Factor 2 verification failed.');
      }

      this.earcon.gateUnlockedSound();
      this.state.login.partialSessionToken = data.partialSessionToken;
      this.state.login.gateExpiresAt = new Date(data.expiresAt).getTime();

      // Show Gate Preview
      const tokenDisplay = document.getElementById('gate-token-display');
      if (tokenDisplay) tokenDisplay.textContent = data.partialSessionToken;

      this.startGateCountdown();
      this.setLoginStep(3);
      this.announce('Factor 2 tactile secret verified! Session gate created with five minute expiry.');
    } catch (err) {
      this.showError('login-f2-error', err.message);
      this.earcon.errorSound();
    }
  }

  startGateCountdown() {
    if (this.state.login.gateTimerInterval) {
      clearInterval(this.state.login.gateTimerInterval);
    }
    const update = () => {
      const diff = Math.max(0, this.state.login.gateExpiresAt - Date.now());
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      const timerEl = document.getElementById('gate-countdown');
      if (timerEl) timerEl.textContent = formatted;

      if (diff <= 0) {
        clearInterval(this.state.login.gateTimerInterval);
        this.earcon.errorSound();
        this.announce('Session gate expired. Returning to Factor 2 spacebar PIN.', 'assertive');
        this.setLoginStep(2);
        this.resetLoginCapture();
        this.showError('login-f2-error', '⏳ 5-minute session gate expired. Please re-enter your 4-digit spacebar PIN.');
      }
    };
    update();
    this.state.login.gateTimerInterval = setInterval(update, 1000);
  }

  async startFactor1Ceremony() {
    this.hideError('login-f1-error');
    const { userId, partialSessionToken } = this.state.login;

    // Gate Invariant Check: If no token or token missing, return straight to Factor 2
    if (!partialSessionToken || !userId) {
      this.setLoginStep(2);
      this.resetLoginCapture();
      this.showError('login-f2-error', '🔒 Factor 2 spacebar PIN required before biometric authentication.');
      this.announce('Please enter your Factor 2 spacebar PIN first.');
      return;
    }

    this.setLoginStep(4);
    const statusMsg = document.getElementById('f1-status-msg');
    const retryBtn = document.getElementById('btn-retry-f1');
    const backBtn = document.getElementById('btn-back-to-f2');
    if (retryBtn) retryBtn.classList.add('hidden');
    if (backBtn) backBtn.classList.add('hidden');

    try {
      statusMsg.textContent = 'Requesting WebAuthn challenge with D2 session gate token...';
      const optRes = await fetch('/api/login/webauthn/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, partialSessionToken }),
      });
      const options = await optRes.json();
      if (!optRes.ok) throw new Error(options.error || 'Failed to generate WebAuthn challenge');

      statusMsg.textContent = 'Touch platform biometric sensor / Touch ID...';
      this.announce('Touch your biometric authenticator now.');

      const asseResp = await SimpleWebAuthnBrowser.startAuthentication({ optionsJSON: options });

      statusMsg.textContent = 'Verifying cryptographic signature & counter...';
      const verifyRes = await fetch('/api/login/webauthn/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          partialSessionToken,
          response: asseResp,
        }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.success) {
        throw new Error(verifyData.error || 'Authentication assertion verification failed.');
      }

      this.earcon.successSound();
      this.state.currentUser = verifyData.user;
      this.state.sessionToken = verifyData.sessionToken;
      this.updateAuthUI(true, verifyData.user);

      this.announce('Biometric verification passed. Welcome back!');
      setTimeout(() => {
        this.navigate('dashboard');
      }, 500);
    } catch (err) {
      statusMsg.textContent = 'Biometric verification failed.';
      const isGateError = err.message.includes('SESSION_ALREADY_USED') || err.message.includes('SESSION_EXPIRED') || err.message.includes('SESSION_NOT_FOUND') || err.message.includes('SESSION_GATE_REJECTED') || err.message.includes('PartialAuthSession');

      if (isGateError) {
        // Automatically take user back to Factor 2 (Tactile Spacebar)
        this.earcon.errorSound();
        this.showError('login-f1-error', '🔒 Session gate expired or already used. Returning to Factor 2...');
        this.announce('Session gate expired. Returning to Factor 2 spacebar PIN.', 'assertive');
        setTimeout(() => {
          this.setLoginStep(2);
          this.resetLoginCapture();
          this.showError('login-f2-error', '🔒 Previous session gate expired or consumed. Please re-enter your 4-digit spacebar PIN.');
        }, 1200);
        return;
      }

      this.showError('login-f1-error', err.message || 'Biometric gesture failed.');
      this.earcon.errorSound();
      this.announce('Biometric verification failed. You can retry or re-enter Factor 2.');
      if (retryBtn) retryBtn.classList.remove('hidden');
      if (backBtn) backBtn.classList.remove('hidden');
    }
  }

  setLoginStep(stepNum) {
    this.state.login.step = stepNum;
    for (let i = 1; i <= 4; i++) {
      const pane = document.getElementById(`login-step-${i}`);
      const node = document.getElementById(`login-stepnode-${i}`);
      const line = document.getElementById(`login-stepline-${i}`);

      if (pane) pane.classList.toggle('active', i === stepNum);
      if (node) {
        node.classList.toggle('active', i === stepNum);
        node.classList.toggle('completed', i < stepNum);
      }
      if (line) line.classList.toggle('active', i < stepNum);
    }
    if (stepNum === 2) {
      setTimeout(() => {
        const pad = document.getElementById('login-capture-area');
        if (pad) {
          pad.focus();
          pad.classList.add('focused');
        }
      }, 60);
    }
  }

  // ==========================================
  // 6. Dashboard & Security Telemetry
  // ==========================================
  async checkCurrentSession() {
    try {
      const res = await fetch('/api/me');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          this.state.currentUser = data.user;
          this.updateAuthUI(true, data.user);
          if (this.state.currentPage === 'login' || this.state.currentPage === 'register') {
            this.navigate('dashboard');
          }
          return;
        }
      }
    } catch (e) {
      // Not logged in
    }
    this.state.currentUser = null;
    this.updateAuthUI(false);
  }

  async loadDashboard() {
    try {
      const res = await fetch('/api/me');
      if (!res.ok) {
        this.state.currentUser = null;
        this.updateAuthUI(false);
        this.navigate('login');
        return;
      }
      const data = await res.json();
      if (!data.success) throw new Error('Session invalid');

      this.state.currentUser = data.user;
      this.updateAuthUI(true, data.user);

      document.getElementById('dash-display-name').textContent = data.user.displayName;
      document.getElementById('dash-username').textContent = `@${data.user.username}`;
      document.getElementById('dash-avatar').textContent = data.user.displayName.charAt(0).toUpperCase();

      // Render credentials list
      const credsContainer = document.getElementById('credentials-list');
      if (credsContainer) {
        if (!data.credentials || data.credentials.length === 0) {
          credsContainer.innerHTML = '<p class="muted">No WebAuthn passkeys enrolled.</p>';
        } else {
          credsContainer.innerHTML = data.credentials
            .map(
              (c) => `
              <div class="cred-item">
                <div class="status-row">
                  <strong>Passkey ID</strong>
                  <span class="badge badge-cyan">FIDO2 Platform</span>
                </div>
                <div class="cred-id">${c.id}</div>
                <div class="status-row" style="margin-top:0.4rem;">
                  <span>Sign Counter: <strong>${c.signCount}</strong></span>
                  <span>Enrolled: ${new Date(c.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            `
            )
            .join('');
        }
      }

      // Render recent audit logs
      this.renderAuditLogsTable(data.logs || [], 'dashboard-audit-logs');
    } catch (err) {
      this.state.currentUser = null;
      this.updateAuthUI(false);
      this.navigate('login');
    }
  }

  async loadLogs() {
    try {
      const res = await fetch('/api/logs');
      const data = await res.json();
      if (data.success) {
        this.renderAuditLogsTable(data.logs || [], 'telemetry-logs-body');
      }
    } catch (err) {
      console.error('Failed to load logs', err);
    }
  }

  renderAuditLogsTable(logs, targetElementId) {
    const tbody = document.getElementById(targetElementId);
    if (!tbody) return;

    if (logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center muted">No logs recorded yet.</td></tr>';
      return;
    }

    tbody.innerHTML = logs
      .map((l) => {
        const outcomeClass =
          l.outcome === 'SUCCESS' ? 'badge-success' : l.outcome === 'RATE_LIMITED' ? 'badge-purple' : 'badge-danger';
        return `
        <tr>
          <td>${new Date(l.timestamp).toLocaleTimeString()}</td>
          ${targetElementId === 'telemetry-logs-body' ? `<td><code>${l.user_id.slice(0, 10)}...</code></td>` : ''}
          <td><code>${l.factor}</code></td>
          <td>${l.ceremony || '—'}</td>
          <td><span class="badge ${outcomeClass}">${l.outcome}</span></td>
          <td>${l.reason || '—'}</td>
        </tr>
      `;
      })
      .join('');
  }

  async testD2BypassAttack() {
    const resultBox = document.getElementById('d2-attack-result');
    if (!resultBox) return;
    resultBox.classList.remove('hidden');
    resultBox.textContent = 'Executing simulated bypass attack: calling /api/login/webauthn/options with bogus token...';

    try {
      const res = await fetch('/api/login/webauthn/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.state.currentUser ? this.state.currentUser.id : 'unauthorized_user',
          partialSessionToken: 'attacker_forged_gate_token_12345',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        this.earcon.errorSound();
        resultBox.style.color = '#6ee7b7';
        resultBox.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        resultBox.style.background = 'rgba(16, 185, 129, 0.15)';
        resultBox.innerHTML = `
          <strong>🛡️ ATTACK BLOCKED BY DESIGN INVARIANT D2!</strong><br/>
          Status: ${res.status} Forbidden<br/>
          Response: <code>${JSON.stringify(data)}</code><br/>
          <em>Factor 1 WebAuthn challenge strictly rejected unverified session gate.</em>
        `;
        this.announce('Simulated bypass attack successfully blocked by D2 session gate.');
      } else {
        resultBox.textContent = 'Warning: Attack was not blocked.';
      }
    } catch (e) {
      resultBox.textContent = `Attack resulted in error: ${e.message}`;
    }
  }

  async handleLogout() {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch (e) {}
    this.state.currentUser = null;
    this.state.sessionToken = null;
    this.updateAuthUI(false);
    this.earcon.resetSound();
    this.navigate('login');
    this.announce('Logged out successfully. Returned to login page.');
  }

  // --- UI Helpers ---
  showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
      el.textContent = message;
      el.classList.remove('hidden');
    }
  }

  hideError(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
      el.textContent = '';
      el.classList.add('hidden');
    }
  }

  bindGlobalEvents() {
    // Escape key globally resets active tactile pads if focused
  }
}

// Instantiate and attach globally
const app = new TapKeyApp();
window.app = app;
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
