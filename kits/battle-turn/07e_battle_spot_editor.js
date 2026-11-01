// ============================================================
//  The battle spot editor (job battle-place, 1 Nov 2026). Ash: "the engine should have a way to determine if the battle is a manually
//  placed battle or one that uses the rules engine for placement, along with an editor for those that are hand placed".
//  How a fight was placed is battlePlacement() (07_battle.js): 'placed' (a scene battleSpots entry with its own marks), 'spot' (the
//  rules round an authored spot), 'rules' (the rules round where the two sides met), 'fallback' or 'fixed' (a fight on its own painting).
//  The editor works on the real fight: spotEditStart() while a fight on a painted scene is on screen holds the fight still and lets the
//  author drag every fighter on the real backdrop at the real scale (arrow keys nudge the selected one, Shift for 8 px), drag empty
//  ground to move the camera window (where the painting is bigger than the window), and see where feet can stand (the stage's ground
//  map: green = a fighter can stand here, red = not: off the walk map, in another area, under the foreground layer). Each fighter's ring
//  says whether its feet are on good ground. Try it writes the spot into the scene (in memory) and restages the fight from it; Use the
//  rules drops the spot and restages by the rules; Copy JSON gives the scene file's battleSpots entry (scene px): { id, at, view, near
//  (or r), party: [[x, y]...], foes: [[x, y]...] }. Done hands the fight back. Nothing is saved to disk: the JSON goes into
//  assets/game/<scene>.scene.json `battleSpots` (a game's own content).
//  A test page opens it (a game's battle review page puts a button for it); the game itself never does.
// ============================================================
const SPOT_EDIT = { on: false, sel: -1, drag: null, ground: true, groundKey: '', groundCv: null, panel: null, id: '', near: 200, r: null, when: null, rules: false };
const spotEditFighters = () => [...B.party, ...B.enemies];
function spotEditStart() {
  if (G.state !== 'battle' || !B.stage) return false;
  const st = B.stage, sp = typeof st.spot === 'string' ? (SC.def.battleSpots || []).find(s => s.id === st.spot) : null;
  Object.assign(SPOT_EDIT, { on: true, sel: -1, drag: null, groundKey: '', rules: false,
    id: sp ? sp.id : SPOT_EDIT.id && SPOT_EDIT.scene === SC.id ? SPOT_EDIT.id : `${SC.id}_${B.enemies[0] ? B.enemies[0].id : 'fight'}`,
    near: sp && sp.near || 200, r: sp && sp.r || null, when: sp && sp.when || null, scene: SC.id });
  if (B.tr) B.tr.t = B.tr.len;   // the walk onto the marks is over: everyone stands on their mark
  B.impact = 0; B.stop = 0; B.q = []; B.tm = null;
  spotEditPanel();
  return true;
}
function spotEditStop() {
  SPOT_EDIT.on = false; SPOT_EDIT.drag = null;
  if (SPOT_EDIT.panel) { SPOT_EDIT.panel.remove(); SPOT_EDIT.panel = null; }
}
// while the editor is open the fight holds still: only the keys that nudge the selected fighter
function spotEditUpdate() {
  if (G.state !== 'battle' || !B.stage) { spotEditStop(); return; }
  const f = spotEditFighters()[SPOT_EDIT.sel]; if (!f) return;
  const k = SPOT_EDIT.shift ? 8 : 1;
  if (nav('left')) f.x -= k; if (nav('right')) f.x += k; if (nav('up')) f.y -= k; if (nav('down')) f.y += k;
  spotEditChanged();
}
// a battle-screen point from a pointer event on the game canvas
function spotEditAt(ev) { const r = cv.getBoundingClientRect(); return [(ev.clientX - r.left) / r.width * W, (ev.clientY - r.top) / r.height * H]; }
function spotEditHit(x, y) {
  let best = -1, bd = 1e9;
  spotEditFighters().forEach((b, i) => {
    const hw = b.m ? 18 : b.d && b.d.scale ? 32 : 20, top = b.y - (b.sh || 80) - (isFlier(b) ? 30 : 0);
    if (x < b.x - hw || x > b.x + hw || y < top || y > b.y + 10) return;
    const d = Math.abs(x - b.x) + Math.abs(y - b.y) * 0.5; if (d < bd) { bd = d; best = i; }
  });
  return best;
}
cv.addEventListener('pointerdown', ev => {
  if (!SPOT_EDIT.on) return;
  const [x, y] = spotEditAt(ev), i = spotEditHit(x, y);
  SPOT_EDIT.sel = i;
  const st = B.stage;
  if (i >= 0) { const b = spotEditFighters()[i]; SPOT_EDIT.drag = { kind: 'fighter', dx: x - b.x, dy: y - b.y }; }
  else if (st.win[2] < SC.ww || st.win[3] < SC.wh) SPOT_EDIT.drag = { kind: 'pan', x, y };
  else SPOT_EDIT.drag = null;
  try { cv.setPointerCapture(ev.pointerId); } catch (e) {}
  ev.preventDefault();
});
cv.addEventListener('pointermove', ev => {
  const d = SPOT_EDIT.drag; if (!SPOT_EDIT.on || !d) return;
  const [x, y] = spotEditAt(ev);
  if (d.kind === 'fighter') { const b = spotEditFighters()[SPOT_EDIT.sel]; b.x = Math.round(x - d.dx); b.y = Math.round(y - d.dy); }
  else spotEditPan(d.x - x, d.y - y), d.x = x, d.y = y;
  spotEditChanged();
});
cv.addEventListener('pointerup', () => { SPOT_EDIT.drag = null; });
for (const t of ['keydown', 'keyup']) window.addEventListener(t, e => { SPOT_EDIT.shift = e.shiftKey; });
// move the camera window by (dx, dy) battle px; the fighters keep their place on the ground
function spotEditPan(dx, dy) {
  const st = B.stage, w = st.win, nx = clamp(w[0] + dx / st.zx, 0, Math.max(0, SC.ww - w[2])), ny = clamp(w[1] + dy / st.zy, 0, Math.max(0, SC.wh - w[3]));
  const mx = (nx - w[0]) * st.zx, my = (ny - w[1]) * st.zy; if (!mx && !my) return;
  w[0] = nx; w[1] = ny;
  for (const b of spotEditFighters()) { b.x -= mx; b.y -= my; }
  const iw = SC.img.width / SC.ww; B.opts.crop = w.map(v => v * iw); B.bgc = null; B.bgInk = null;
}
function spotEditChanged() { const t = SPOT_EDIT.panel && SPOT_EDIT.panel.querySelector('textarea'); if (t) t.value = JSON.stringify(spotEditJSON()); spotEditStatus(); }
// is fighter b standing on good ground (the stage's ground map: walkable, the hero's area, clear of the foreground layer)?
function spotEditFeetOk(b) {
  if (isFlier(b)) return true;
  const ok = battleGroundMap(), h = b.m ? 12 : b.d.scale ? 22 : 14;
  return !!ok && ok(b.x, b.y) && ok(b.x - h, b.y) && ok(b.x + h, b.y) && b.y >= 104 && b.y <= 266;
}
// the scene file's battleSpots entry for what is on screen (scene px)
function spotEditJSON() {
  const st = B.stage, K = SC.k || 1, P = b => [Math.round((st.win[0] + b.x / st.zx) / K), Math.round((st.win[1] + b.y / st.zy) / K)];
  const o = { id: SPOT_EDIT.id, at: [Math.round((st.win[0] + st.P0[0] / st.zx) / K), Math.round((st.win[1] + st.P0[1] / st.zy) / K)], view: [Math.round(st.win[0] / K), Math.round(st.win[1] / K)] };
  if (SPOT_EDIT.r) o.r = SPOT_EDIT.r; else o.near = SPOT_EDIT.near;
  if (SPOT_EDIT.when) o.when = SPOT_EDIT.when;
  o.party = B.party.map(P); o.foes = B.enemies.map(P);
  return o;
}
// Try it: the spot into the scene (in memory, replacing one with the same id) and the fight staged again from it
function spotEditApply() {
  const sp = spotEditJSON(), list = SC.def.battleSpots || (SC.def.battleSpots = []), i = list.findIndex(s => s.id === sp.id);
  if (i >= 0) list[i] = sp; else list.push(sp);
  spotEditRestage(sp.id);
}
// Use the rules: the spot out of the scene (in memory) and the fight staged again by the rules
function spotEditRules() {
  const list = SC.def.battleSpots || [], i = list.findIndex(s => s.id === SPOT_EDIT.id);
  if (i >= 0) list.splice(i, 1);
  SPOT_EDIT.rules = true; spotEditRestage(false);
}
function spotEditRestage(spot) {
  if (!B.snap) return;
  const id = SPOT_EDIT.id, near = SPOT_EDIT.near, r = SPOT_EDIT.r, when = SPOT_EDIT.when, rules = SPOT_EDIT.rules;
  const s = B.snap, opts = Object.assign({}, s.opts, { spot, transition: false }); delete opts.crop; s.opts = opts;
  for (const [m, hp, ki] of s.party) { m.hp = hp; m.ki = ki; }   // as Try again: the fight as it began (its own restart, so a page that
  G.inv = JSON.parse(JSON.stringify(s.inv)); B.retrying = true;    // replaces battleRetry, like a boss test, keeps the edit)
  startBattle(s.ids, opts);
  spotEditStart(); Object.assign(SPOT_EDIT, { id, near, r, when, rules });
  spotEditChanged();
}
function spotEditStatus() {
  const el = SPOT_EDIT.panel && SPOT_EDIT.panel.querySelector('[data-k=status]'); if (!el) return;
  const pl = battlePlacement(), bad = spotEditFighters().filter(b => !spotEditFeetOk(b)).length;
  const how = { placed: 'hand-placed', spot: 'rules round an authored spot', rules: 'rules (where the sides met)', fallback: 'fallback (no room: the default formation)', fixed: 'fixed formation (own painting)' }[pl.mode] || pl.mode;
  el.textContent = `Placement: ${how}${typeof pl.spot === 'string' ? ' · spot ' + pl.spot : ''} · ${bad ? bad + ' off good ground' : 'every pair of feet on good ground'}`;
}
// the editor's panel under the game screen (a plain test-page control, outside the game's look)
function spotEditPanel() {
  if (SPOT_EDIT.panel) SPOT_EDIT.panel.remove();
  const el = document.createElement('div'); SPOT_EDIT.panel = el; el.id = 'spotEditPanel';
  el.style.cssText = 'width:min(100%,1280px);display:grid;gap:6px;font:13px system-ui,sans-serif;color:#eadcbf;background:#1a1216;border:1px solid #6a5a48;padding:8px;box-sizing:border-box';
  const b = (k, label) => `<button data-k="${k}" style="padding:4px 10px">${label}</button>`;
  el.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center"><b>Battle spot editor</b><span data-k="status"></span></div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">Spot id <input data-k="id" value="${SPOT_EDIT.id}" style="width:16em">
      covers meeting points within <input data-k="near" type="number" value="${SPOT_EDIT.near}" style="width:5em"${SPOT_EDIT.r ? ' disabled title="this spot uses its r rectangle"' : ''}> scene px
      ${b('ground', SPOT_EDIT.ground ? 'Ground map: on' : 'Ground map: off')} ${b('apply', 'Try it')} ${b('rules', 'Use the rules here')} ${b('copy', 'Copy JSON')} ${b('done', 'Done')}</div>
    <div style="color:#a89a80">Drag a fighter to move it (arrow keys nudge the selected one, Shift for 8 px); drag open ground to move the camera. Green ground: feet can stand there. Copy JSON goes in the scene file's <code>battleSpots</code>.</div>
    <textarea readonly rows="3" style="width:100%;font:12px monospace;background:#0f0b0e;color:#eadcbf"></textarea>`;
  const frame = document.querySelector('.frame') || cv.parentNode; frame.parentNode.insertBefore(el, frame.nextSibling);
  el.querySelector('[data-k=id]').onchange = e => { SPOT_EDIT.id = e.target.value.trim().replace(/[^\w-]/g, '_') || SPOT_EDIT.id; spotEditChanged(); };
  el.querySelector('[data-k=near]').onchange = e => { SPOT_EDIT.near = Math.max(0, Math.round(+e.target.value) || 200); spotEditChanged(); };
  el.querySelector('[data-k=ground]').onclick = () => { SPOT_EDIT.ground = !SPOT_EDIT.ground; spotEditPanel(); };
  el.querySelector('[data-k=apply]').onclick = () => spotEditApply();
  el.querySelector('[data-k=rules]').onclick = () => spotEditRules();
  el.querySelector('[data-k=copy]').onclick = () => { const t = el.querySelector('textarea'); t.select(); try { navigator.clipboard.writeText(t.value); } catch (e) { try { document.execCommand('copy'); } catch (e2) {} } };
  el.querySelector('[data-k=done]').onclick = () => { spotEditStop(); cv.focus(); };
  spotEditChanged();
}
// over the fight (screen canvas X): the ground map under the battle UI (spotEditGround), every fighter's feet ring and the window's scene
// px over it (spotEditDraw)
function spotEditGround() {
  const st = B.stage; if (!st) return;
  if (SPOT_EDIT.ground) {
    const key = st.win.map(Math.round).join(',');
    if (SPOT_EDIT.groundKey !== key || !SPOT_EDIT.groundCv) {
      const gw = Math.ceil(W / 4), gh = Math.ceil(H / 4), [c, g] = SPOT_EDIT.groundCv || mk(gw, gh), id = g.createImageData(gw, gh), ok = battleGroundMap();
      for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { const n = (j * gw + i) * 4, good = ok(i * 4 + 2, j * 4 + 2);
        id.data[n] = good ? 60 : 210; id.data[n + 1] = good ? 200 : 60; id.data[n + 2] = good ? 90 : 50; id.data[n + 3] = good ? 60 : 22; }
      g.putImageData(id, 0, 0); SPOT_EDIT.groundCv = [c, g]; SPOT_EDIT.groundKey = key;
    }
    X.save(); X.imageSmoothingEnabled = false; X.drawImage(SPOT_EDIT.groundCv[0], 0, 0, W * S, H * S); X.restore();
  }
}
function spotEditDraw() {
  const st = B.stage; if (!st) return;
  spotEditFighters().forEach((b, i) => {
    const good = spotEditFeetOk(b), sel = i === SPOT_EDIT.sel, hw = (b.m ? 12 : b.d.scale ? 22 : 14) * S;
    X.save(); X.lineWidth = (sel ? 3 : 1.5) * S / 2; X.strokeStyle = good ? '#7fe08a' : UI.seal;
    X.beginPath(); X.ellipse(b.x * S, b.y * S, hw, hw * 0.35, 0, 0, Math.PI * 2); X.stroke(); X.restore();
    if (sel) txt(`${b.name} ${spotEditJSON()[b.m ? 'party' : 'foes'][b.m ? B.party.indexOf(b) : B.enemies.indexOf(b)].join(', ')}`, b.x, b.y + 8, good ? '#c8f0c8' : '#ffb0a0', 9, 'center');
  });
  txt(`window ${Math.round(st.win[0] / (SC.k || 1))}, ${Math.round(st.win[1] / (SC.k || 1))} (scene px)`, 6, 4, '#eadcbf', 9);
}
