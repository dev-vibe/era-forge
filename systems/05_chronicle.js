// ============================================================
//  The Chronicle system (job fw-F3b, 28 Oct 2026; was the engine half of 05j_chronicle.js (Job 12a) and 05j_chronicle_art.js (Job 12h))
//  A journal in tabs whose entries appear when their conditions hold and whose text follows the story; reading state (new, revised),
//  the hanko notice when entries are recorded or revised, the scroll an entry is read on (captioned art, real page turns), and
//  proof as a mechanic: a debate where each objection is answered with a proof held, and a wrong proof costs nerve.
//  State: the save namespace sys.chronicle = { seen: { entry id: 1 }, read: { entry id: the text signature when it was last read } }.
//  Reads only the game's content (01a_game.js):
//    chronicle   { tabs: [names], entries: [{ id, tab, title, when(F), text(F), q? (an open question), art? { img, r } }], open(F) (when
//                  the page appears), notes { question, <tab name>: label, default } (the kicker above an entry), footer ('{hero}’s
//                  chronicle'), glyph (the seal on the scroll and the notice), visual?(e) -> { img | cast, caption, r?, silhouette? }
//                  (the picture beside an entry; without it, the entry's own art) }
//    proofs      { id: { name, held(F) } }   evidence the hero holds
//    debate      { hud (the nerve's label), nerve (marks), bad: [lines for a wrong proof], fail() -> steps (the nerve ran out),
//                  ask?, wait?, think? }   a debate step is meetAsk({ who, ask: [lines], ok: { proof id: [steps] } })
//  Asset names: a picture whose image starts item_ (a story-item sheet on white paper) is laid on the scroll with a multiply blend.
// ============================================================
const chronDef = () => content('chronicle');
const chronTabs = () => chronDef().tabs || [];
const chronEntries = () => chronDef().entries || [];
const chronNoteLabel = e => { const N = chronDef().notes || {}; return e.q ? N.question : N[e.tab] || N.default; };
const chronOn = () => !!(G.f && chronDef().open && chronDef().open(G.f));
function chronTabList(tab) { const F = G.f || {}; return chronEntries().filter(e => e.tab === tab && e.when(F)); }
const Chron = { tab: 0 };
const chronList = () => chronTabList(chronTabs()[Chron.tab]);
defineSaveSpace('chronicle', { init: () => ({ seen: {}, read: {} }) });
const chronState = () => sysState('chronicle');
const chronNew = e => !e.q && !chronState().seen[e.id];
function chronSwitch(d) { const n = chronTabs().length; Chron.tab = (Chron.tab + n + d) % n; }
function chronFoot(e) {   // the first sentences that fit the menu's two footer lines
  const t = e.text(G.f), parts = t.match(/[^.!?]+[.!?]+["']?\s*/g) || [t]; let out = '';
  for (const p of parts) { if ((out + p).length > 130 && out) break; out += p; }
  return out.trim();
}
function chronOpen(e) {
  chronState().seen[e.id] = 1; sfx('ok');
  chronState().read[e.id] = chronSignature(e);
  ChronNotice.pending.delete(e.id);
  G.card = { pages: [{ kind: 'chron', title: e.title.replace(/^\? /, ''), note: chronNoteLabel(e),
    body: e.text(G.f), art: chronVisual(e) }], i: 0, t: 0, onDone: () => {} };
}
// The scroll entry: Mincho heading, Zen Maru body, captioned approved art and real page turns.
function drawChronPage(o, a, c) {
  X.save(); X.globalAlpha = a;
  headTxt(o.note.toUpperCase(), 64, 43, UI.soft, 10, 'left', 700, null);
  const titles = wrap(o.title, 512, 22, true);
  titles.forEach((l, i) => headTxt(l, 64, 62 + 24 * i, UI.ink, 22, 'left', 800, null));
  uiStroke(X, 64 * S, 115 * S, 242 * S, 116 * S, 3 * S, mulberry(o.title.length * 7), UI.seal, 0.8 * a, 1);
  const pages = chronPages(o.body), sub = c.sub | 0;
  pages[sub].forEach((l, i) => chronBody(l, 64, 133 + i * 16));
  X.fillStyle = 'rgba(144,110,56,.09)'; X.fillRect(394 * S, 130 * S, 184 * S, 146 * S);
  drawChronArt(o.art, 400, 136, 172, 134);
  wrap(o.art && o.art.caption || '', 180, 9.5).forEach((l, i) => chronBody(l, 486, 281 + 12 * i, 9.5, 'center', UI.soft));
  headTxt(`${gameText(chronDef().footer)} · ${sub + 1}/${pages.length}`, 64, 307, UI.faint, 10, 'left', 500, null);
  if (chronDef().glyph) uiStamp(558, 299, 19, chronDef().glyph, 0.06);
  X.restore();
}
// The observer coalesces new/revised entries into a nonblocking hanko toast after the scene.
const chronNote = what => () => chronObserve();


// ---------------- proofs held ----------------
const proofsHeld = () => Object.keys(content('proofs')).filter(id => contentGet('proofs', id).held(G.f));


// ---------------- the debate: answering objections with proofs (e.g. a town meeting) ----------------
const MEET = { nerve: 3, wrong: 0, show: false, flash: 0 };
function meetAsk(o) {
  const D = content('debate'), ids = proofsHeld(), opts = [...ids.map(id => contentGet('proofs', id).name), D.wait || '(Say nothing yet)'];
  return [[o.who, ...o.ask], { ask: D.ask || 'Answer with which proof?', opts, then: [
    ...ids.map(id => o.ok[id]
      ? [() => { sfx('ok'); }, ...o.ok[id]]
      : [() => { MEET.nerve--; MEET.wrong++; MEET.flash = 40; sfx('deny'); }, ['', D.bad[(MEET.wrong - 1 + D.bad.length) % D.bad.length]],   // (built with the step list, before this mistake is counted)
        () => MEET.nerve > 0 ? meetAsk(o) : D.fail()]),
    [[GAME.hero.name, D.think || '(Not yet. Think.)'], () => meetAsk(o)]] }];
}
// the nerve: ink marks at the top of the screen while a debate runs (drawn by render, 08_main.js); e.g. the crowd's nerve at a meeting
function drawMeetHud() {
  if (!MEET.show || G.state !== 'scene' || G.card) return;
  if (MEET.flash > 0) MEET.flash--;
  const x = 320, y = 14, sh = MEET.flash > 0 ? Math.sin(MEET.flash * 0.9) * 2 * (MEET.flash / 40) : 0;
  win(x - 92, y, 184, 34);
  headTxt(content('debate').hud || '', x - 30, y + 11, UI.soft, 11, 'center', 600, null);
  for (let i = 0; i < (content('debate').nerve || 3); i++) {
    const on = i < MEET.nerve, cx = x + 34 + i * 20 + (i === MEET.nerve ? sh : 0);
    X.save(); X.globalAlpha = on ? 0.9 : 0.25; X.fillStyle = on ? UI.ink : UI.faint;
    X.beginPath(); X.ellipse(cx * S, (y + 17) * S, 6.5 * S, 5.5 * S, -0.3, 0, Math.PI * 2); X.fill(); X.restore();
  }
}

// ---------------- presentation and reading state (Job 12h) ----------------
// Reuse approved art at its native colour. Crop coordinates refer to the original scene painting.
function chronVisual(e) { const C = chronDef(); return C.visual ? C.visual(e) : (e.art && { ...e.art, caption: e.title }); }
function chronImage(v) { return v && (v.cast ? castSprite(v.cast, 0, 0) : assetImg(v.img)); }
const CHRON_MOUNTS = new Map();
function drawChronArt(v, x, y, w, h) {
  const im = chronImage(v); if (!im) return false;
  const def = v.r && SCENES[v.img], sc = def && def.iw ? im.width / def.iw : 1;
  const r = v.r || [0, 0, im.width, im.height], sw = (r[2] - r[0]) * sc, sh = (r[3] - r[1]) * sc;
  const k = Math.min(w / sw, h / sh), dw = sw * k, dh = sh * k;
  const key = JSON.stringify(v);
  let mount = CHRON_MOUNTS.get(key);
  if (!mount) {
    const [c, g] = mk(480, Math.max(1, Math.round(480 * sh / sw)));
    g.imageSmoothingEnabled = true;
    if (v.silhouette) g.filter = 'brightness(0)';
    g.drawImage(im, r[0] * sc, r[1] * sc, sw, sh, 0, 0, c.width, c.height);
    g.filter = 'none';
    // A soft paper edge is a UI mask; the approved original is never altered.
    g.globalCompositeOperation = 'destination-in';
    for (const [dx, dy] of [[c.width, 0], [0, c.height]]) {
      const fade = g.createLinearGradient(0, 0, dx, dy);
      fade.addColorStop(0, 'transparent'); fade.addColorStop(.045, '#000');
      fade.addColorStop(.955, '#000'); fade.addColorStop(1, 'transparent');
      g.fillStyle = fade; g.fillRect(0, 0, c.width, c.height);
    }
    mount = c; CHRON_MOUNTS.set(key, c);
  }
  X.save(); X.imageSmoothingEnabled = true;
  if (v.img && v.img.startsWith('item_')) X.globalCompositeOperation = 'multiply';
  X.drawImage(mount, (x + (w - dw) / 2) * S, (y + (h - dh) / 2) * S, dw * S, dh * S);
  X.restore(); return true;
}
function chronThumb(e, x, y) { drawChronArt(chronVisual(e), x, y, 23, 20); }
function chronSignature(e) {
  let h = 2166136261;
  for (const c of e.title + '\n' + e.text(G.f)) h = Math.imul(h ^ c.codePointAt(0), 16777619);
  return (h >>> 0).toString(36);
}
function chronStatus(e) {
  if (e.q) return 'question';
  if (chronNew(e)) return 'new';
  const read = chronState().read;
  return read[e.id] && read[e.id] !== chronSignature(e) ? 'revised' : '';
}
// Ephemeral observation is reset on a new journey/load/review jump (all replace G.f, and a load or new journey G.sys too).
// Historical entries loaded from a save never flood the screen with notifications.
const ChronNotice = { flags: null, state: null, known: new Map(), pending: new Map(), active: null };
function chronObserve() {
  const F = G.f || {}, visible = chronEntries().filter(e => !e.q && e.when(F));
  if (ChronNotice.flags !== F || ChronNotice.state !== chronState()) {
    ChronNotice.flags = F; ChronNotice.state = chronState(); ChronNotice.known = new Map(); ChronNotice.pending.clear(); ChronNotice.active = null;
    for (const e of visible) ChronNotice.known.set(e.id, e.title + '\n' + e.text(F));
    return;
  }
  // Job tests-3: every frame compares the entry's text itself (native string compare) instead of hashing it character by character in
  // JavaScript; that hash was most of the game's per-frame work. The saved read marks (chronState().read) still use chronSignature.
  for (const e of visible) {
    const sig = e.title + '\n' + e.text(F), old = ChronNotice.known.get(e.id);
    if (old !== sig) ChronNotice.pending.set(e.id, { title: e.title, revised: old !== undefined });
    ChronNotice.known.set(e.id, sig);
  }
}
function chronToastSafe() {
  return !Dialog.active && !Script.active && !G.card && !G.stamp && !G.fadeDir && !cineOn() && !CINE.keep &&
    !ItemFX.active && !ItemFX.pending.length && ['scene', 'field', 'road', 'world'].includes(G.state);
}
function chronTick() {
  chronObserve();
  if (!chronToastSafe()) return;
  if (!ChronNotice.active && ChronNotice.pending.size) {
    ChronNotice.active = { entries: [...ChronNotice.pending.values()], t: 0 };
    ChronNotice.pending.clear(); sfx('stamp');
  }
  if (ChronNotice.active && ++ChronNotice.active.t > 210) ChronNotice.active = null;
}
function drawChronNotice() {
  const n = ChronNotice.active;
  if (!n || !chronToastSafe()) return;
  X.save(); X.globalAlpha = Math.min(1, n.t / 12, (211 - n.t) / 24);
  win(324, 14, 302, 68); if (chronDef().glyph) uiStamp(335, 29, 28, chronDef().glyph);
  headTxt(n.entries.every(e => e.revised) ? 'Revised in the Chronicle' : 'Recorded in the Chronicle', 374, 24, UI.seal, 12, 'left', 700, null);
  const label = n.entries.length === 1 ? n.entries[0].title : `${n.entries.length} entries · ${keyName('start')}, then Chronicle`;
  const lines = wrap(label, 236, 11, true);
  lines.slice(0, 2).forEach((l, i) => headTxt(l, 374, 45 + 14 * i, UI.ink, 11, 'left', 500, null));
  X.restore();
}
function chronPages(body) {
  const lines = String(body).split('\n').flatMap(p => wrap(p, 308, 13));
  const pages = []; for (let i = 0; i < lines.length; i += 10) pages.push(lines.slice(i, i + 10));
  return pages.length ? pages : [[]];
}
function chronBody(text, x, y, size = 13, align = 'left', color = UI.ink) {
  setFont(size); X.textAlign = align; X.fillStyle = color;
  X.fillText(text, x * S, y * S); X.textAlign = 'left';
}
function drawChronCard(c) {
  const p = 1 - Math.pow(1 - Math.min(1, c.t / 26), 3), top = 26, bottom = top + 302 * p;
  X.save(); X.fillStyle = 'rgba(12,8,6,.68)'; X.fillRect(0, 0, W * S, H * S);
  X.save(); X.beginPath(); X.rect(36 * S, top * S, 568 * S, (bottom - top) * S); X.clip();
  X.drawImage(uiPage(), 0, 0); drawChronPage(c.pages[c.i], Math.min(1, c.t / 16), c); X.restore();
  themeUI('scrollRails')(top, bottom);   // the paper unrolls between two rails (the theme's; never a painted asset)
  if (c.t > 26) moreMark(320, 339);
  X.restore();
}

// job fw-F3b: an entry opened from the menu is a card page that draws the whole card itself (the scroll; 01a_game.js CARD_PAGES)
defineCardPage('chron', { card: c => drawChronCard(c), draw: (o, a, c) => drawChronPage(o, a, c), pages: o => chronPages(o.body).length });
// the Chronicle as a stock menu page (01a_game.js MENU_STOCK; the game registers it): tabs with Left / Right, an entry read with A
MENU_STOCK.chronicle = { label: 'Chronicle', when: () => chronOn(), list: () => chronList(), use: it => chronOpen(it), turn: d => chronSwitch(d),
  info: it => chronFoot(it) + '  {a} Read',
  title: () => `Chronicle — ${chronTabs()[Chron.tab]}`, head: () => chronTabs().map((t, i) => i === Chron.tab ? '◆' : '◇').join(' ') + '   ◀ ▶',
  row: it => ({ name: it.title, right: chronStatus(it), thumb: (x, y) => chronThumb(it, x, y), fit: true }) };
