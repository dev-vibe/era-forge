// ============================================================
//  Journeys and autosave (0.4.0, 13 Nov 2026: "make the saves automatic for each savegame ... continue can stay and show latest, but
//  saves should be a submenu that has multiple saves"; browser only, nothing on the server)
//
//  A player keeps up to GAME.saves.journeys journeys (default 6) in this browser, each in its own localStorage key, all under the
//  player's name on a host that signs people in (playerKey, 01_core.js):
//    journey 1   <saveKey>          (the key every save used before 0.4.0, so an old save is journey 1)
//    journey n   <saveKey>_j<n>
//  (the '@<player>' always comes last: game_save_v1_j2@mika). One save per journey: no earlier saves (Ash, 13 Nov 2026: "don't worry
//  about [those] ... no need, bc chapters so short").
//  SAVE_KEY (01_core.js) is the journey being played: the latest one when the page opens, a free one after New Journey, the one picked
//  under Saved games; writeSave() writes it.
//
//  Autosave (GAME.saves.autosave, default true): autosaveTick() runs at the end of every update() (08_main.js). It saves when the player
//  has had control for half a second (no dialog, script, card, fade, cutscene, item moment, sleep, road change, warp or hop; in a
//  scene, on a field map, on the road or on the map; not on a scene test page) and either something happened since the last save (the
//  player was not in control: a talk, a fight, a cutscene, the menu, a shop, a minigame, a new place) or GAME.saves.every seconds of
//  play went by (default 120). A game can hold it back with GAME_HOOKS.autosaveBlock() returning true.
//
//  The title (08_main.js): Continue plays the latest journey; New Journey starts in a free one (none free: Saved games opens with a note);
//  Saved games opens the panel below: the journeys, newest first, each with its place, level and play time; a journey offers Play and
//  Delete (asked twice); on the release page a last row leads to the save files page (download, import).
// ============================================================
const JOURNEY_CFG = Object.assign({ journeys: 6, every: 120, autosave: true }, GAME.saves || {});
const journeyKey = n => playerKey(SAVE_BASE + (n > 1 ? '_j' + n : ''));
const Journey = { n: 1 };
function journeyRead(n) { return readSaveAt(journeyKey(n)); }
// the journeys that have a save, newest first: [{ n, d }]
function journeyList() {
  const out = [];
  for (let n = 1; n <= JOURNEY_CFG.journeys; n++) { const d = journeyRead(n); if (d && d.hero) out.push({ n, d }); }
  return out.sort((a, b) => (b.d.t || 0) - (a.d.t || 0) || a.n - b.n);
}
function journeyUse(n) { Journey.n = n; SAVE_KEY = journeyKey(n); return n; }
// the first journey with no save, or 0 when all are in use
function journeyFree() {
  for (let n = 1; n <= JOURNEY_CFG.journeys; n++) { const d = journeyRead(n); if (!(d && d.hero)) return n; }
  return 0;
}
function journeyLatest() { const l = journeyList(); return l.length ? l[0].n : 0; }
try { journeyUse(journeyLatest() || 1); } catch (e) {}
function journeyDelete(n) {
  try { localStorage.removeItem(journeyKey(n)); } catch (e) {}
  if (Journey.n === n) journeyUse(journeyLatest() || 1);
}

// ---------------- Autosave ----------------
const Autosave = { calm: 0, dirty: false, at: 0, count: 0, last: null };
function autosaveSafe() {
  if (!G.hero || !['scene', 'field', 'road', 'world'].includes(G.state) || window.SCENE_TEST) return false;
  if (Script.active || Dialog.active || G.card || G.stamp || G.fadeDir || G.fade > 0) return false;
  if (typeof cineOn === 'function' && (cineOn() || CINE.keep)) return false;
  if (typeof ItemFX === 'object' && (ItemFX.active || ItemFX.pending.length)) return false;
  if (typeof SLEEP === 'object' && SLEEP.ph) return false;
  if (G.state === 'road' && typeof roadState === 'function') { const r = roadState(); if (r && r.transition) return false; }
  if (G.state === 'scene' && (SC.warp || SC.hop)) return false;
  return gameHook('autosaveBlock') !== true;
}
function autosaveTick() {
  if (!JOURNEY_CFG.autosave) return;
  if (!autosaveSafe()) { Autosave.calm = 0; Autosave.dirty = true; return; }
  if (++Autosave.calm < 30) return;
  const pt = sysState('play').time;
  if (!Autosave.dirty && pt - Autosave.at < JOURNEY_CFG.every) return;
  Autosave.dirty = false; Autosave.at = pt;
  if (writeSave(saveData())) { Autosave.count++; Autosave.last = { n: Journey.n, frame, state: G.state }; }
}
// a journey just started or loaded: nothing to save until something happens
function autosaveReset() { Autosave.calm = 0; Autosave.dirty = false; Autosave.at = G.sys && G.sys.play ? G.sys.play.time : 0; }

// ---------------- Saved games (the title's panel) ----------------
// Title.saves = { sel, top, list, open: null | { n, sel, opts, del: 0|1 }, note }
const JP_ROWS = 6;
function savesOpen(note) {
  const list = journeyList();
  Title.saves = { sel: 0, top: 0, list, open: null, note: note || '' };
}
function savesRows() {
  const P = Title.saves, rows = P.list.map(j => ({ j }));
  if (PLAYER_PAGE && window.GAME_SITE.saves) rows.push({ files: true });
  return rows;
}
function savesPlay(d, n) {
  const selected = titleConfig(cfg()), override = Title.override;
  journeyUse(n); Title.saves = null;
  warp(() => { loadData(d); if (override) G.cfg = selected; autosaveReset(); });
}
function savesUpdate() {
  const P = Title.saves, rows = savesRows();
  if (P.open) {
    const o = P.open;
    if (o.del) {
      if (btn('b') || nav('up') || nav('down')) { o.del = 0; sfx('back'); return; }
      if (btn('a')) { sfx('ok'); journeyDelete(o.n); titleRefresh(); savesOpen('Journey ' + o.n + ' deleted.'); }
      return;
    }
    if (btn('b')) { P.open = null; sfx('back'); return; }
    if (nav('up')) { o.sel = (o.sel + o.opts.length - 1) % o.opts.length; sfx('cursor'); }
    if (nav('down')) { o.sel = (o.sel + 1) % o.opts.length; sfx('cursor'); }
    if (btn('a')) {
      const pick = o.opts[o.sel]; sfx('ok');
      if (pick === 'Play') { const d = journeyRead(o.n); if (d && d.hero) savesPlay(d, o.n); }
      else if (pick === 'Delete') o.del = 1;
      else P.open = null;
    }
    return;
  }
  if (btn('b')) { Title.saves = null; sfx('back'); return; }
  if (!rows.length) return;
  if (nav('up')) { P.sel = (P.sel + rows.length - 1) % rows.length; sfx('cursor'); }
  if (nav('down')) { P.sel = (P.sel + 1) % rows.length; sfx('cursor'); }
  P.sel = clamp(P.sel, 0, rows.length - 1);
  if (P.sel < P.top) P.top = P.sel; if (P.sel >= P.top + JP_ROWS) P.top = P.sel - JP_ROWS + 1;
  if (btn('a')) {
    const r = rows[P.sel]; sfx('ok');
    if (r.files) { location.href = window.GAME_SITE.saves; return; }
    P.open = { n: r.j.n, sel: 0, opts: ['Play', 'Delete', 'Back'], del: 0 };
  }
}
function savesWhen(d) {
  if (!Number.isFinite(d.t)) return '';
  const t = new Date(d.t), now = new Date(), day = 864e5, days = Math.floor((new Date(now.toDateString()) - new Date(t.toDateString())) / day);
  const hm = t.toTimeString().slice(0, 5);
  return days <= 0 ? 'today ' + hm : days === 1 ? 'yesterday ' + hm : t.toISOString().slice(0, 10);
}
function drawSaves() {
  const P = Title.saves, rows = savesRows();
  X.fillStyle = 'rgba(8,12,16,.55)'; X.fillRect(0, 0, W * S, H * S);
  const x = 90, y = 34, w = 460, h = 292;
  win(x, y, w, h);
  headTxt('Saved games', x + w / 2, y + 12, UI.ink, 16, 'center', 700);
  if (P.note) txt(P.note, x + w / 2, y + 38, UI.soft, 10, 'center', false);
  const top = y + 56;
  if (!rows.length) txt('No saved journeys in this browser yet.', x + w / 2, top + 40, UI.soft, 12, 'center');
  rows.slice(P.top, P.top + JP_ROWS).forEach((r, i) => {
    const idx = P.top + i, yy = top + i * 34, on = idx === P.sel && !P.open;
    if (on) selBar(x + 16, yy - 3, w - 32, 30);
    if (r.files) { txt('Save files (download, import)', x + 44, yy + 6, on ? UI.ink : UI.soft, 12); if (on) cursor(x + 26, yy + 6); return; }
    const d = r.j.d, latest = idx === 0;
    txt('Journey ' + r.j.n + (latest ? '  ·  latest' : ''), x + 44, yy, on || (P.open && P.open.n === r.j.n) ? UI.ink : UI.soft, 12);
    txt(titleSaveSummary(d), x + 44, yy + 14, UI.soft, 10, 'left', false);
    txt(savesWhen(d), x + w - 28, yy, UI.soft, 10, 'right', false);
    if (on) cursor(x + 26, yy + 2);
  });
  if (rows.length > JP_ROWS) txt((P.top > 0 ? '▲ ' : '') + (P.top + JP_ROWS < rows.length ? '▼' : ''), x + w - 28, y + h - 24, UI.soft, 10, 'right', false);
  if (P.open) drawSavesOpen(P.open);
  const hint = Input.touchMode ? 'Tap {a}   {b} Back' : '{up}{down} Choose   {a} Confirm   {b} Back';
  txt(hint, x + 18, y + h - 24, UI.soft, 10, 'left', false);
}
function drawSavesOpen(o) {
  const x = 330, y = 120, w = 230;
  if (o.del) {
    win(x - 60, y, w + 60, 76);
    txt('Delete Journey ' + o.n + ' for good?', x - 44, y + 14, UI.ink, 12);
    txt('{a} Delete   {b} Keep it', x - 44, y + 44, UI.soft, 11, 'left', false);
    return;
  }
  const h = 26 + o.opts.length * 24;
  win(x, y, w - 60, h);
  o.opts.forEach((t, i) => { const yy = y + 12 + i * 24; txt(t, x + 34, yy, i === o.sel ? UI.ink : UI.soft, 12); if (i === o.sel) cursor(x + 16, yy + 1); });
}
