import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiveRegion, announceAuthState } from '../src/liveRegion.js';
import { createEarconPlayer } from '../src/earconPlayer.js';
import { createKeyHandler } from '../src/keyHandler.js';

test('announces normal, repeated, and urgent authentication states', () => {
  const attributes = {};
  const element = { setAttribute(key, value) { attributes[key] = value; }, remove() { this.removed = true; }, textContent: '' };
  const doc = { createElement() { return element; } };
  const root = { ownerDocument: doc, appendChild(node) { assert.equal(node, element); } };
  const region = createLiveRegion(root);
  announceAuthState(region, 'identity_acknowledged');
  assert.match(element.textContent, /Username received/);
  assert.equal(attributes['aria-live'], 'polite');
  announceAuthState(region, 'factor2_failure');
  assert.equal(attributes['aria-live'], 'assertive');
  region.destroy();
  assert.equal(element.removed, true);
});

test('earcons require opt-in and private output confirmation', async () => {
  const frequencies = [];
  class AudioContextMock {
    currentTime = 0;
    destination = {};
    createOscillator() { return { frequency: { set value(v) { frequencies.push(v); } }, connect() {}, start() {}, stop() {} }; }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
    async close() {}
  }
  const player = createEarconPlayer({ AudioContextClass: AudioContextMock });
  assert.equal(player.tap(), false);
  player.setEnabled(true);
  assert.equal(player.tap(), false);
  player.setPrivateOutputConfirmed(true);
  assert.equal(player.tap(), true);
  assert.equal(player.tap(), true);
  assert.ok(frequencies[1] > frequencies[0]);
  await player.destroy();
});

test('keyboard callbacks skip editable targets and repeated keys', () => {
  const target = new EventTarget();
  const calls = [];
  const handler = createKeyHandler({ target, onSpace: () => calls.push('space'), onSubmit: () => calls.push('enter'), onCancel: () => calls.push('escape') });
  function fire(key, extra = {}) {
    const event = new Event('keydown', { cancelable: true });
    Object.defineProperty(event, 'key', { value: key });
    Object.defineProperty(event, 'repeat', { value: Boolean(extra.repeat) });
    target.dispatchEvent(event);
    return event;
  }
  assert.equal(fire(' ').defaultPrevented, true);
  fire('Enter'); fire('Escape'); fire(' ', { repeat: true });
  assert.deepEqual(calls, ['space', 'enter', 'escape']);
  handler.destroy();
  fire(' ');
  assert.equal(calls.length, 3);
});
