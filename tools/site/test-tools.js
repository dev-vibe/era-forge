// Hosted tests reuse the existing scenario builders. A fresh page per jump clears every
// transient animation, dialog, battle and camera without maintaining a second reset list.
(() => {
  const status = document.getElementById('test-status');
  const category = document.getElementById('test-category');
  const sessionKey = '__CONTROLS_KEY__' + category.value;
  const remember = () => {
    try { sessionStorage.setItem(sessionKey, JSON.stringify({cfg: G.cfg, log: typeof BT === 'object' ? BT.log : []})); } catch {}
  };
  category.addEventListener('change', () => location.assign('/test/' + category.value + '/'));
  document.getElementById('test-restart').addEventListener('click', () => { remember(); location.reload(); });
  const selector = '#jumps button[data-j], #bossPanel button[data-k], #bossPanel button[data-tech], #item-review button[data-item]';
  const key = button => button.dataset.j !== undefined ? 'jump:' + button.dataset.j :
    button.dataset.item !== undefined ? 'item:' + button.dataset.item :
    button.dataset.tech !== undefined ? 'tech:' + button.dataset.tech : 'fight:' + button.dataset.k;
  let replaying = false;
  // Capture before the original jump handlers; choosing a scenario always starts clean.
  document.addEventListener('click', event => {
    const button = event.target.closest(selector);
    if (!button || replaying) return;
    event.preventDefault(); event.stopImmediatePropagation();
    remember();
    const url = new URL(location.href); url.searchParams.set('jump', key(button));
    location.assign(url.href);
  }, true);
  const ready = () => {
    if (!window.TEST_READY) { requestAnimationFrame(ready); return; }
    try {
      const saved = JSON.parse(sessionStorage.getItem(sessionKey) || '{}');
      if (saved.cfg) G.cfg = saved.cfg;
      if (typeof BT === 'object' && saved.log) BT.log = saved.log;
    } catch {}
    const buttons = [...document.querySelectorAll(selector)];
    const requested = new URL(location.href).searchParams.get('jump');
    const selected = buttons.find(button => key(button) === requested) || buttons[0];
    if (selected) {
      const url = new URL(location.href); url.searchParams.set('jump', key(selected));
      history.replaceState(null, '', url);
      replaying = true; selected.click(); replaying = false;
      // Battle controls rebuild their buttons when starting a preset.
      for (const button of document.querySelectorAll(selector)) button.setAttribute('aria-pressed', String(key(button) === key(selected)));
      status.textContent = 'Testing: ' + selected.textContent.trim() + '. Z / Enter to interact. Practice save only.';
    } else status.textContent = 'Choose a scenario below the game. Practice save only.';
    window.__TEST_READY__ = true;
  };
  requestAnimationFrame(ready);
})();
