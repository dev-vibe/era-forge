// ============================================================
//  Controls: control schemes, the gamepad, key names for on-screen hints
//  (job a11y, 28 Oct 2026; charter area 8: "a two tier keybinding (obvious switch between wasd/arrows/controller if not auto,
//  and then a deeper keybind only if needed for the game mechanics)")
// ============================================================
// TIER 1 is the Settings row "Controls: Auto / Arrows / WASD / Controller" (07c_settings.js; saved as G.cfg.ctl, old saves load as 'auto').
// A scheme never switches keys off: every keyboard key below works in every scheme (the table is collision-free, checked at load and by
// controls_test.py). The scheme picks the keys the hints name ("Z" / "Space" / "A"), and Auto picks it from what the player last pressed.
// The touch pad is separate and unchanged: while it shows, hints name its buttons (A, B, MENU).
//
// TIER 2 (per-action rebinding) was NOT built: no mechanic needs it (the audit is in the charter, area 8). CONTROL_KEYS is the one table
// a future rebinding page would edit: action -> keys per scheme (keyboard: KeyboardEvent.code, the physical key; controller: a button
// index of the browser's standard gamepad mapping). The FIRST key of each list is the one the hints name.
const CONTROL_KEYS = {
  arrows: { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
    a: ['KeyZ', 'Space', 'Enter'], b: ['KeyX', 'Escape', 'Backspace', 'ShiftLeft', 'ShiftRight'], start: ['KeyC', 'KeyM', 'Tab'] },
  wasd: { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
    a: ['Space', 'KeyJ', 'KeyE', 'Enter'], b: ['ShiftLeft', 'ShiftRight', 'KeyK', 'KeyQ', 'Escape', 'Backspace'], start: ['Tab', 'KeyC', 'KeyM'] },
  // standard mapping: 0 A (Cross), 1 B (Circle), 3 Y (Triangle), 9 Start (Options / Menu), 12-15 the d-pad; the left stick moves too (PAD_DEAD)
  pad: { up: [12], down: [13], left: [14], right: [15], a: [0], b: [1], start: [9, 3] },
};
const CONTROL_ACTIONS = ['up', 'down', 'left', 'right', 'a', 'b', 'start'];
// keys the game reads outside the action table (01_core.js, 05c_scene.js); no scheme may use them
const CONTROL_RESERVED = { KeyN: 'sound on / off', KeyV: 'hero silhouette on / off (painted scenes)', KeyT: 'day / dusk (scene test pages)', KeyG: 'hidden layers (scene test pages)',
  BracketLeft: 'switch character (scene test pages)', BracketRight: 'switch character (scene test pages)' };
for (let i = 0; i < 10; i++) { CONTROL_RESERVED['Digit' + i] = CONTROL_RESERVED['Numpad' + i] = 'switch character (scene test pages)'; }
const CONTROL_SCHEMES = ['auto', 'arrows', 'wasd', 'pad'];
const CONTROL_NAMES = { auto: 'Auto', arrows: 'Arrows', wasd: 'WASD', pad: 'Controller' };
const PAD_DEAD = 0.5;   // left-stick dead zone
const PAD_NAMES = { 0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT', 8: 'Back', 9: 'Start', 10: 'L3', 11: 'R3', 12: '↑', 13: '↓', 14: '←', 15: '→' };
const KEY_GLYPH = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'Space', Enter: 'Enter', Escape: 'Esc', Backspace: 'Backspace', ShiftLeft: 'Shift', ShiftRight: 'Shift', Tab: 'Tab' };
const TOUCH_NAMES = { a: 'A', b: 'B', start: 'MENU', up: '↑', down: '↓', left: '←', right: '→', move: 'Pad', moveKeys: 'the pad arrows' };
const Ctl = { last: 'arrows', pad: {}, layout: null, family: {}, clashes: [] };

// KEYMAP (01_core.js) = every keyboard key of every scheme; Ctl.family = the scheme a key belongs to alone (what Auto listens for)
(function controlsBuild() {
  for (const k in KEYMAP) delete KEYMAP[k];
  const owner = {};
  for (const s of ['arrows', 'wasd']) for (const act of CONTROL_ACTIONS) for (const code of CONTROL_KEYS[s][act]) {
    if (CONTROL_RESERVED[code]) Ctl.clashes.push(`${code}: ${s} ${act} / ${CONTROL_RESERVED[code]}`);
    else if (KEYMAP[code] && KEYMAP[code] !== act) Ctl.clashes.push(`${code}: ${KEYMAP[code]} / ${s} ${act}`);
    else KEYMAP[code] = act;
    (owner[code] = owner[code] || new Set()).add(s);
  }
  for (const code in owner) if (owner[code].size === 1) Ctl.family[code] = [...owner[code]][0];
  if (Ctl.clashes.length) console.warn('controls: keys with two meanings', Ctl.clashes);
})();

// ---------------- the active scheme ----------------
const ctlSetting = () => (typeof G === 'object' && G.cfg && CONTROL_NAMES[G.cfg.ctl] && G.cfg.ctl) || 'auto';
function ctlScheme() { if (Input.touchMode) return 'touch'; const s = ctlSetting(); return s === 'auto' ? Ctl.last : s; }
function ctlStep(d) { const c = cfg(), i = CONTROL_SCHEMES.indexOf(ctlSetting()); c.ctl = CONTROL_SCHEMES[(i + d + CONTROL_SCHEMES.length) % CONTROL_SCHEMES.length]; controlsBar(); }

// ---------------- key names for hints ----------------
// keyName(action): the name of the key that does `action` in the active scheme ('a', 'b', 'start', 'up', 'down', 'left', 'right'),
// or 'move' (a short label: Arrows, WASD, D-pad) and 'moveKeys' (for a sentence: the arrow keys, W A S D, the d-pad or stick).
// keyText(s) fills {a} {b} {start} {up} {down} {left} {right} {move} {moveKeys} in a line of text (dialogue goes through it in openDialog).
function keyGlyph(code) {
  if (typeof code === 'number') return PAD_NAMES[code] || 'Button ' + code;
  if (KEY_GLYPH[code]) return KEY_GLYPH[code];
  let lay = null; try { lay = Ctl.layout && Ctl.layout.get(code); } catch (e) {}
  if (lay && lay.length === 1 && lay.trim()) return lay.toUpperCase();   // the key cap of the player's own layout (AZERTY's KeyW reads Z)
  return code.replace(/^(Key|Digit)/, '');
}
function keyName(act, s = ctlScheme()) {
  if (s === 'touch') return TOUCH_NAMES[act] || act;
  const K = CONTROL_KEYS[s] || CONTROL_KEYS.arrows;
  if (act === 'move') return s === 'arrows' ? 'Arrows' : s === 'pad' ? 'D-pad' : ['up', 'left', 'down', 'right'].map(a => keyGlyph(K[a][0])).join('');
  if (act === 'moveKeys') return s === 'arrows' ? 'the arrow keys' : s === 'pad' ? 'the d-pad or stick' : ['up', 'left', 'down', 'right'].map(a => keyGlyph(K[a][0])).join(' ');
  return K[act] ? keyGlyph(K[act][0]) : act;
}
const keyText = s => typeof s === 'string' ? s.replace(/\{(a|b|start|up|down|left|right|move|moveKeys)\}/g, (_, a) => keyName(a)) : s;
// the line on the Settings page under the Controls row
function ctlDesc() {
  const s = ctlSetting(), e = ctlScheme(), k = a => keyName(a, e);
  const keys = e === 'touch' ? 'The touch pad is showing: its own A, B and MENU buttons.' : `${k('move')} move · ${k('a')} confirm · ${k('b')} cancel, hold to run · ${k('start')} menu.`;
  return (s === 'auto' ? `Follows what you last pressed (now ${CONTROL_NAMES[Ctl.last]}). ` : 'Every key still works; the hints name these. ') + keys;
}

// ---------------- Auto: what was pressed last ----------------
window.addEventListener('keydown', e => { const f = Ctl.family[e.code]; if (f) { Ctl.last = f; controlsBar(); } }, true);
try { if (navigator.keyboard && navigator.keyboard.getLayoutMap) navigator.keyboard.getLayoutMap().then(m => { Ctl.layout = m; Ctl.barFor = null; controlsBar(); }).catch(() => {}); } catch (e) {}

// ---------------- the gamepad (browser Gamepad API), polled once a frame from inputEndFrame (01_core.js) ----------------
function padRead() {
  let pads; try { pads = navigator.getGamepads ? navigator.getGamepads() : null; } catch (e) { return {}; }
  const st = {};
  for (const p of pads || []) {
    if (!p || p.connected === false) continue;
    const on = i => { const b = p.buttons && p.buttons[i]; return !!b && (b.pressed || b.value > 0.5); };
    for (const act of CONTROL_ACTIONS) if (CONTROL_KEYS.pad[act].some(on)) st[act] = true;
    const ax = (p.axes && p.axes[0]) || 0, ay = (p.axes && p.axes[1]) || 0;
    if (ax < -PAD_DEAD) st.left = true; if (ax > PAD_DEAD) st.right = true; if (ay < -PAD_DEAD) st.up = true; if (ay > PAD_DEAD) st.down = true;
  }
  return st;
}
function padPoll() {
  const st = padRead();
  for (const k of CONTROL_ACTIONS) {
    const now = !!st[k], was = !!Ctl.pad[k];
    if (now && !was) { if (typeof rhythmStamp === 'function') rhythmStamp(k); press(k); Ctl.last = 'pad'; }   // a rhythm minigame stamps the press first (05a)
    else if (!now && was) release(k);
    Ctl.pad[k] = now;
  }
  controlsBar();
}

// ---------------- the key strip under the game (shell.html .keys) follows the scheme ----------------
function controlsBar() {
  const s = ctlScheme(); if (s === Ctl.barFor) return; Ctl.barFor = s;
  const el = document.querySelector('.keys'); if (!el || s === 'touch') return;
  const k = a => `<kbd>${keyName(a, s)}</kbd>`;
  el.dataset.scheme = s;
  el.innerHTML = `<span>${s === 'arrows' ? '<kbd>←↑↓→</kbd>' : k('move')}move</span><span>${k('a')}talk / confirm</span><span>${k('b')}cancel · hold to run</span><span>${k('start')}menu</span>`;
}
