/** Keyboard orchestration; captureTapPattern remains owned by Factor 2. */
export function createKeyHandler({ target, onSpace, onSubmit, onCancel } = {}) {
  if (!target?.addEventListener) throw new TypeError('A keyboard event target is required');
  const handlers = { Space: onSpace, Enter: onSubmit, Escape: onCancel };
  function handle(event) {
    const key = event.code === 'Space' || event.key === ' ' ? 'Space' : event.key;
    const handler = handlers[key];
    if (!handler || event.repeat || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    const element = event.target;
    if (element?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(element?.tagName)) return;
    event.preventDefault();
    handler(event);
  }
  target.addEventListener('keydown', handle);
  return { destroy() { target.removeEventListener('keydown', handle); } };
}
