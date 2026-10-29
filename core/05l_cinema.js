// ============================================================
//  The cinema layer (Job 13, 22 Oct 2026)
//  The game's cutscenes are staged in the engine, on the approved paintings and sprites, not as generated video: the three
//  planned video cutscenes (a fog lifting off a mountain, a line breaking, the lanterns of a festival) are already
//  played in the engine (the fog overlay, a stampede, a dance intro), and the small personal beats are where the story lives.
//  This file is the film grammar those scenes share. HOW TO USE IT (workflow, staging and framing rules, inserts, lessons log): the cutscene
//  playbook, the cutscene playbook in the repo's claude/ docs. Script steps (asked first of all: STORY_STEPS order 100, registered at the end of this file):
//    { cine: true | false }                       letterbox bars in / out; while they are up the dialog box becomes subtitles
//    { shot: [x, y] | 'hero' | 'npc id' | null, zoom, time, block }
//                                                 the camera moves (eased in and out) to a point (painting px) or a person and
//                                                 zooms about it; null = back to following the hero at zoom 1, then released
//    { mem: 0..1, time }                          memory grade: sepia ink, paper grain and a soft vignette (flashbacks)
//    { ghost: 'npc id', a, time }                 a person seen in memory fades in, see-through (a = most opacity)
//    { fadeOut: 'npc id', time }                  a person fades away and is hidden
//    { drift: 'npc id', to: [x, y] | path, speed }      a person walks there and keeps walking while text is shown (a memory's
//                                                 procession; the ordinary { walk } stops under a dialog box)
//    { sil: 'npc id', on }                        a person drawn as a dark silhouette (someone not yet shown, e.g. Genba)
//    { glint: target, n, col }                    a few sparks of light at a point (painting px), the hero or a person
//    { lights: [[x, y, r, col, flick], ...] | null, time }   small lights of this scene (painting px): candles, a lantern
//    { echo: 'text', who, time }                  a remembered voice: one line in the middle of the screen, no box (blocking)
//    { cutin: 'cast id', time }                   anime cut-in: a band across the screen with the speaker's eyes (fictional
//                                                 people only; real historical figures stay at a distance, runbook section 1)
//    { insert: 'id' | [ids], time, kb, block, hold }   an illustrated close-up (Ash's app image `ins_<id>`) with a slow Ken Burns
//                                                 move, brushed in and out; skipped when the image does not exist yet;
//                                                 a list = keyframes, { insertFrame: n } dissolves; { insert: null } closes a held one
//    { keepsake: 'item id', line }                the story-item moment of 12g: a hanging scroll unrolls with the item's
//                                                 illustration (`item_<id>`, or an ink ensō until it exists), its meaning,
//                                                 and a vermilion seal stamps where it went (blocking until Z)
//  Everything here is code drawing (bars, grades, particles, text); no painting or art layer is made by code.
// ============================================================
const CINE = { bar: 0, barTo: 0, cur: null, tw: null, hold: null, mem: 0, memTo: 0, memV: 0, glints: [], fades: [], lights: null, lightA: 0, lightTo: 0, lightV: 0,
  echo: null, ins: null, cut: null, keep: null, drifts: [] };
const CINE_BAR = 46;   // letterbox bar height at full (logical px): 640 x 268 between the bars, about 2.4 : 1
const cineEase = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const cineOn = () => CINE.bar > 0.6;

// a new scene: the camera, the particles and the lights belong to the old painting (the bars stay as they are)
function cineSceneReset() {
  CINE.cur = null; CINE.tw = null; CINE.hold = null; CINE.glints = []; CINE.fades = []; CINE.lights = null; CINE.lightA = CINE.lightTo = 0;
  CINE.mem = CINE.memTo = 0; CINE.cut = null; CINE.drifts = [];
}
// a target as a point in the world (logical px): [x, y] in painting px, 'hero', or an NPC id (aimed at the body, not the feet)
function cineTarget(t) {
  const k = SC.k, f = scHK();
  if (Array.isArray(t)) return { x: t[0] * k, y: t[1] * k };
  const n = t && t !== 'hero' ? scNpc(t) : null;
  if (n) return { x: n.x, y: n.y - 18 * f };
  return { x: SC.hero.x, y: SC.hero.y - 18 * f };
}
// where the ordinary camera would look (the centre of its view), so a shot can hand back without a jump
function cineHome() {
  const h = SC.hero;
  const tx = SC.ww <= W ? (SC.ww - W) / 2 : clamp(h.x - W / 2, 0, SC.ww - W);
  const ty = SC.wh <= H ? (SC.wh - H) / 2 : clamp(h.y - H / 2 - 12, 0, SC.wh - H);
  return { x: tx + W / 2, y: ty + H / 2 };
}
// the camera for the current shot: a view W/z wide centred on the point, kept inside the painting, zoomed about the screen centre
function cineView() {
  const c = CINE.cur, z = Math.max(1, c.z), vw = W / z, vh = H / z;
  const vx = SC.ww <= vw ? (SC.ww - vw) / 2 : clamp(c.x - vw / 2, 0, SC.ww - vw);
  const vy = SC.wh <= vh ? (SC.wh - vh) / 2 : clamp(c.y - vh / 2, 0, SC.wh - vh);
  SC.cam.x = vx + vw / 2 - W / 2; SC.cam.y = vy + vh / 2 - H / 2;
  ST.zoom = ST.zoomTo = z;
}

// ---------------- script steps ----------------
function cineStep(s) {
  if (s.cine !== undefined) { CINE.barTo = s.cine ? 1 : 0; return 'next'; }
  if (s.shot !== undefined) {
    if (G.state !== 'scene' || !SC.hero) return 'next';
    const from = CINE.cur ? { x: CINE.cur.x, y: CINE.cur.y } : { x: SC.cam.x + W / 2, y: SC.cam.y + H / 2 }, z0 = CINE.cur ? CINE.cur.z : (ST.zoom || 1);
    const release = s.shot === null, T = Math.max(1, s.time == null ? 90 : s.time);
    CINE.tw = { from, z0, to: s.shot, z1: release ? 1 : (s.zoom || z0), t: 0, T, wait: !!s.block, release };
    CINE.hold = null; ST.cam = null;
    if (!CINE.cur) CINE.cur = { x: from.x, y: from.y, z: z0 };
    if (s.time === 0) { CINE.tw.t = T - 1; cineTween(); return 'next'; }
    return s.block ? 'wait' : 'next';
  }
  if (s.mem != null) { CINE.memTo = s.mem; CINE.memV = Math.abs(s.mem - CINE.mem) / Math.max(1, s.time || 40); return 'next'; }
  if (s.ghost) { const n = scNpc(s.ghost); if (n) { n.hidden = false; n.alpha = 0; n.maxA = s.a || 0.6; n.fadeIn = s.time || 40; } return 'next'; }
  if (s.fadeOut) { const n = scNpc(s.fadeOut); if (n && !n.hidden) CINE.fades.push({ n, v: Math.max(0.01, n.alpha) / Math.max(1, s.time || 40) }); return 'next'; }
  if (s.drift) {   // to: [x, y] or a path [[x, y], ...] (painting px)
    const n = scNpc(s.drift), pts = Array.isArray(s.to[0]) ? s.to : [s.to];
    if (n) CINE.drifts.push({ n, pts: pts.map(([x, y]) => [x * SC.k, y * SC.k]), sp: s.speed || 0.5 });
    return 'next';
  }
  if (s.sil) { const n = scNpc(s.sil); if (n) n.sil = s.on !== false; return 'next'; }
  if (s.glint) { cineGlint(s.glint, s.n || 9, s.col || '#fff4d0'); return 'next'; }
  if (s.lights !== undefined) {
    if (s.lights) { CINE.lights = s.lights; CINE.lightTo = 1; } else CINE.lightTo = 0;
    CINE.lightV = 1 / Math.max(1, s.time || 30); if (s.time === 0) CINE.lightA = CINE.lightTo;
    return 'next';
  }
  if (s.echo) { CINE.echo = { text: s.echo, who: s.who || '', t: 0, T: Math.max(60, s.time || 150) }; return 'wait'; }
  if (s.cutin) { const img = assetImg('portrait_' + s.cutin); if (img) { CINE.cut = { img, t: 0, T: Math.max(30, s.time || 80) }; sfx('ki'); } return 'next'; }
  if (s.insert === null) {   // close a held insert (brushed out), then go on
    if (!CINE.ins) return 'next';
    CINE.ins.out = CINE.ins.out || 1; CINE.ins.wait = true; return 'wait';
  }
  if (s.insert) {
    // one id, or a list of keyframes (`ins_<id>` each; a missing one is skipped): `{ insertFrame: n }` dissolves to frame n.
    // hold: true keeps the insert up under the following dialog lines until `{ insert: null }` (the close-up stays on screen while
    // the subtitles play in the bottom bar); otherwise it blocks for `time` frames or until Z.
    const ids = Array.isArray(s.insert) ? s.insert : [s.insert], imgs = ids.map(id => assetImg('ins_' + id));
    const first = imgs.findIndex(Boolean); if (first < 0) return 'next';   // until Ash's illustration exists the shot is simply not there
    const hold = !!s.hold;
    CINE.ins = { imgs, cur: first, prev: -1, xf: 1, t: 0, T: Math.max(60, s.time || (hold ? 600 : 210)), kb: s.kb || [0.5, 0.5, 1.0, 0.5, 0.5, 1.12], hold, wait: !hold && s.block !== false, out: 0 };
    return CINE.ins.wait ? 'wait' : 'next';
  }
  if (s.insertFrame != null) {
    const ins = CINE.ins; if (ins && ins.imgs[s.insertFrame] && ins.cur !== s.insertFrame) { ins.prev = ins.cur; ins.cur = s.insertFrame; ins.xf = 0; ins.xfN = Math.max(1, s.time || 16); }
    return 'next';
  }
  if (s.keepsake) {
    const it = contentGet('items', s.keepsake); if (!it) return 'next';
    const ksf = contentGet('keepsakes', s.keepsake), ks = ksf ? ksf() : null;   // job fw-F3b: the game's keepsakes (content kind keepsakes, 05_bonds.js)
    CINE.keep = { id: s.keepsake, name: ks ? ks.name : it.name, line: s.line || '', img: assetImg('item_' + s.keepsake), t: 0, out: 0, ens: null, stamped: false };
    sfx('card_turn'); return 'wait';
  }
  return undefined;
}

// ---------------- close-ups inside ANY script (Job 18d, 27 Oct 2026) ----------------
// The hearth talks, the wake-up, the road stops and the town meeting are ordinary scripts, so the same `ins_<id>` keyframes (`_a` before,
// none = the key frame, `_c` after) can play there too, between the bars. Every helper is a script step that returns [] (nothing at all)
// while the art does not exist, so the story reads exactly as before until Ash's close-up is in `assets/game/`.
//   insShow(id, { each, kb, frames })   a short beat of its own: bars in (unless a cine scene already has them), the keyframes one after the
//                                       other (`each` frames apiece, default 70), bars out. `frames: [1]` plays only that keyframe (0 = _a, 1 = key, 2 = _c).
//   insOpen(id, { kb, time }) ... insClose()   held under the lines in between (they become subtitles), like the rosary
const insHas = id => !!(assetImg('ins_' + id) || assetImg('ins_' + id + '_a') || assetImg('ins_' + id + '_c'));
const insNames = id => [id + '_a', id, id + '_c'];
function insShow(id, opt = {}) {
  return () => {
    if (!insHas(id)) return [];
    const bars = !cineOn(), each = opt.each || 70, order = (opt.frames || [0, 1, 2]).filter(i => assetImg('ins_' + insNames(id)[i])), st = [];
    if (!order.length) return [];
    if (bars) st.push({ cine: true });
    st.push({ insert: insNames(id), hold: true, kb: opt.kb, time: 600 });
    order.forEach((i, k) => { if (k) st.push({ insertFrame: i, time: 22 }); else if (CINE_INS_FIRST(id, order[0])) st.push({ insertFrame: i, time: 1 }); st.push({ wait: k === order.length - 1 ? each + 24 : each }); });
    st.push({ insert: null }); if (bars) st.push({ cine: false });
    return st;
  };
}
// (the insert opens on the first keyframe that exists, whatever `frames` asks for: when that is not the first to show, jump straight to it)
const CINE_INS_FIRST = (id, want) => insNames(id).findIndex(n => assetImg('ins_' + n)) !== want;
function insOpen(id, opt = {}) {
  return () => {
    if (!insHas(id)) return [];
    CINE.insBars = !cineOn();
    return [...(CINE.insBars ? [{ cine: true }] : []), { insert: insNames(id), hold: true, kb: opt.kb, time: opt.time || 600 }];
  };
}
const insClose = () => () => CINE.ins ? [{ insert: null }, ...(CINE.insBars ? [{ cine: false }] : [])] : [];

// ---------------- per-frame (update() calls this every frame, also while a dialog box is open) ----------------
function cineTween() {
  const tw = CINE.tw; if (!tw) return;
  tw.t++;
  const k = cineEase(Math.min(1, tw.t / tw.T)), to = tw.release ? cineHome() : cineTarget(tw.to);
  CINE.cur = { x: tw.from.x + (to.x - tw.from.x) * k, y: tw.from.y + (to.y - tw.from.y) * k, z: tw.z0 + (tw.z1 - tw.z0) * k };
  if (tw.t < tw.T) return;
  CINE.tw = null;
  if (tw.release) { CINE.cur = null; ST.zoom = ST.zoomTo = 1; sceneCamera(true); }
  else CINE.hold = Array.isArray(tw.to) ? null : tw.to;   // a shot on a person keeps them framed while they move
  if (tw.wait) nextStep();
}
function cineTick() {
  CINE.bar += Math.sign(CINE.barTo - CINE.bar) * Math.min(Math.abs(CINE.barTo - CINE.bar), 1 / 22);
  if (CINE.mem !== CINE.memTo) CINE.mem = CINE.mem < CINE.memTo ? Math.min(CINE.memTo, CINE.mem + CINE.memV) : Math.max(CINE.memTo, CINE.mem - CINE.memV);
  if (CINE.lightA !== CINE.lightTo) CINE.lightA = CINE.lightA < CINE.lightTo ? Math.min(CINE.lightTo, CINE.lightA + CINE.lightV) : Math.max(CINE.lightTo, CINE.lightA - CINE.lightV);
  if (CINE.cut && ++CINE.cut.t > CINE.cut.T) CINE.cut = null;
  const e = CINE.echo; if (e && ++e.t >= e.T) { CINE.echo = null; nextStep(); }
  const ins = CINE.ins;
  if (ins) {
    ins.t++; if (ins.xf < 1) ins.xf = Math.min(1, ins.xf + 1 / (ins.xfN || 16));
    if (!ins.out && !ins.hold && (ins.t >= ins.T || (ins.t > 50 && btn('a')))) ins.out = 1;
    if (ins.out && ++ins.out > 22) { CINE.ins = null; if (ins.wait) nextStep(); }
  }
  const kp = CINE.keep;
  if (kp) {
    kp.t++;
    if (kp.t === 74) { kp.stamped = true; sfx('stamp'); }
    if (!kp.out && kp.t > 96 && btn('a')) { kp.out = 1; sfx('cursor'); }
    if (kp.out && ++kp.out > 18) { CINE.keep = null; nextStep(); }
  }
  if (G.state !== 'scene' || !SC.hero) return;
  if (CINE.tw) cineTween();
  else if (CINE.cur && CINE.hold) { const p = cineTarget(CINE.hold); CINE.cur.x += (p.x - CINE.cur.x) * 0.08; CINE.cur.y += (p.y - CINE.cur.y) * 0.08; }
  if (CINE.cur) cineView();
  for (const f of CINE.fades.slice()) { f.n.alpha = Math.max(0, f.n.alpha - f.v); f.n.fadeIn = 0; if (f.n.alpha <= 0) { f.n.hidden = true; CINE.fades.splice(CINE.fades.indexOf(f), 1); } }
  for (const d of CINE.drifts.slice()) {
    const n = d.n, [tx, ty] = d.pts[0], dx = tx - n.x, dy = ty - n.y, dd = Math.hypot(dx, dy);
    if (dd <= d.sp) { n.x = tx; n.y = ty; d.pts.shift(); if (!d.pts.length) { n.moving = false; CINE.drifts.splice(CINE.drifts.indexOf(d), 1); } continue; }
    n.x += dx / dd * d.sp; n.y += dy / dd * d.sp; n.moving = true; n.step++; n.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : (dy < 0 ? 1 : 0);
  }
  for (const g of CINE.glints) { g.t++; g.x += g.vx; g.y += g.vy; g.vy -= 0.004; }
  CINE.glints = CINE.glints.filter(g => g.t < g.T);
}
function cineGlint(t, n, col) {
  if (G.state !== 'scene' || !SC.hero) return;
  const p = Array.isArray(t) ? cineTarget(t) : (() => { const q = cineTarget(t); return { x: q.x, y: q.y + 4 * scHK() }; })();
  for (let i = 0; i < n; i++) CINE.glints.push({ x: p.x + rnd(-5, 5), y: p.y + rnd(-4, 4), vx: rnd(-0.12, 0.12), vy: rnd(-0.22, -0.04), t: -i * 3, T: 46 + rnd(0, 24), col, r: rnd(1.4, 2.6) });
}

// ---------------- drawing ----------------
// world space (inside drawScene's camera transform): sparks of light
function cineWorld() {
  for (const g of CINE.glints) {
    if (g.t < 0) continue;
    const a = Math.sin(Math.PI * g.t / g.T), r = g.r * (0.6 + 0.4 * a);
    L.globalCompositeOperation = 'lighter'; L.globalAlpha = 0.55 * a; L.drawImage(glowSprite(6, '#ffd890'), g.x - 6, g.y - 6);
    L.globalAlpha = 0.9 * a; L.fillStyle = g.col; L.fillRect(g.x - r, g.y - 0.5, r * 2, 1); L.fillRect(g.x - 0.5, g.y - r, 1, r * 2);
    L.globalAlpha = 1; L.globalCompositeOperation = 'source-over';
  }
}
// the scene's own small lights (05c pushes these into its lighting pass)
function cineLights(lights, cx, cy) {
  if (!CINE.lights || !(CINE.lightA > 0.02)) return;
  const k = SC.k, a = CINE.lightA;
  for (const [x, y, r, col, flick] of CINE.lights) lights.push({ x: x * k - cx, y: y * k - cy, r: Math.max(4, r * k * (0.6 + 0.4 * a)), col, flick: flick || 0, bloom: 0.75 * a });
}
// memory grade over the painted world (render() calls this right after the world is drawn)
let CINE_GRAIN = null;
function cineGrade() {
  if (!(CINE.mem > 0.01)) return;
  const a = CINE.mem;
  X.save(); X.globalAlpha = a; X.filter = 'sepia(0.85) saturate(0.6) contrast(0.9) brightness(1.06)'; X.imageSmoothingEnabled = false;
  X.drawImage(lo, 0, 0, W * S, H * S); X.restore();
  const g = X.createRadialGradient(320 * S, 180 * S, 90 * S, 320 * S, 180 * S, 380 * S);
  g.addColorStop(0, 'rgba(70,48,26,0)'); g.addColorStop(1, `rgba(52,34,18,${0.62 * a})`);
  X.fillStyle = g; X.fillRect(0, 0, W * S, H * S);
  if (!CINE_GRAIN) { const R = mulberry(1601); let gg; [CINE_GRAIN, gg] = mk(320, 180); for (let i = 0; i < 2600; i++) { gg.fillStyle = R() < 0.5 ? 'rgba(255,246,226,.5)' : 'rgba(40,26,14,.5)'; gg.fillRect(R() * 320, R() * 180, 1, 1); } }
  X.globalAlpha = 0.16 * a; X.imageSmoothingEnabled = true; X.drawImage(CINE_GRAIN, (frame % 3) * S, (frame % 2) * S, W * S, H * S); X.imageSmoothingEnabled = false; X.globalAlpha = 1;
}
// the screen-space layers, drawn over the scene and under the dialog: an insert, the bars, a cut-in, an echo, a keepsake
function drawCine() {
  if (CINE.ins) drawCineInsert(CINE.ins);
  const bh = CINE_BAR * cineEase(Math.max(0, Math.min(1, CINE.bar)));
  if (bh > 0.2) { X.fillStyle = '#07060a'; X.fillRect(0, 0, W * S, Math.ceil(bh * S)); X.fillRect(0, (H - bh) * S, W * S, Math.ceil(bh * S) + 1); }
  if (CINE.cut) drawCineCut(CINE.cut);
  if (CINE.echo) {
    const e = CINE.echo, a = Math.min(1, e.t / 30, (e.T - e.t) / 30), onWhite = ST.white > 0.5;
    X.globalAlpha = Math.max(0, a);
    headTxt(e.text, 320, 166, onWhite ? 'rgba(74,62,52,.9)' : 'rgba(240,230,210,.92)', 15, 'center', 500, null);
    if (e.who) headTxt(e.who, 320, 192, onWhite ? 'rgba(150,120,100,.8)' : 'rgba(200,180,150,.7)', 10, 'center', 500, null);
    X.globalAlpha = 1;
  }
  if (CINE.keep) drawKeepsake(CINE.keep);
}
// subtitles: while the bars are up, a line of dialog sits in the bottom bar (drawDialog asks first)
function cineSubs() {
  if (!cineOn() || !Dialog.active || (Dialog.choices && Dialog.page === Dialog.pages.length - 1) || (typeof CROWD === 'object' && CROWD.top)) return false;
  const bh = CINE_BAR * cineEase(Math.min(1, CINE.bar)), y0 = H - bh + 4, pg = Dialog.pages[Dialog.page], who = Dialog.who;
  const thought = isHeroName(who) && /^\(/.test(pg[0] || ''), narr = !who;
  let left = Dialog.shown;
  const col = narr ? '#e6dcc6' : thought ? '#bfb6a4' : '#f6eedc', x = narr ? 320 : 128, al = narr ? 'center' : 'left', lh = pg.length > 2 ? 13 : 15, top = y0 + (pg.length > 2 ? 1 : pg.length > 1 ? 4 : 11);
  if (who) headTxt(who === '' ? '' : who, 116, top - 1, thought ? '#a99c86' : UI.sealHi, 11, 'right', 700, null);
  pg.forEach((ln, i) => { const s = ln.slice(0, Math.max(0, left)); left -= ln.length; txt(s, x, top + i * lh, col, 12, al, false); });
  if (Dialog.shown >= pg.join('').length) moreMark(618, H - 12);
  return true;
}
// an illustrated close-up between the bars, drifting slowly (Ken Burns), brushed in from the left and faded out
function drawCineInsert(ins) {
  const [x0, y0, z0, x1, y1, z1] = ins.kb, k = cineEase(Math.min(1, ins.t / ins.T));
  const top = CINE_BAR, h = H - 2 * CINE_BAR, z = z0 + (z1 - z0) * k, fx = x0 + (x1 - x0) * k, fy = y0 + (y1 - y0) * k;
  const place = img => { const sc = Math.max(W / img.width, h / img.height) * z, dw = img.width * sc, dh = img.height * sc;   // keyframes share the move
    return [clamp(W / 2 - fx * dw, W - dw, 0), clamp(top + h / 2 - fy * dh, top + h - dh, top), dw, dh]; };
  const rev = Math.min(1, ins.t / 26), a = ins.out ? Math.max(0, 1 - ins.out / 22) : 1;
  X.save(); X.globalAlpha = a;
  X.beginPath(); const e = W * cineEase(rev) + 30;   // a ragged brush edge sweeping right
  X.moveTo(0, top * S);
  for (let y = top; y <= top + h; y += 9) X.lineTo((e - 18 + hash(y, 13) * 18) * S, y * S);
  X.lineTo(0, (top + h) * S); X.closePath(); X.clip();
  X.fillStyle = '#0c0a0c'; X.fillRect(0, top * S, W * S, h * S);
  X.imageSmoothingEnabled = true; X.imageSmoothingQuality = 'high';
  const draw = (img, al) => { const [dx, dy, dw, dh] = place(img); X.globalAlpha = a * al; X.drawImage(img, dx * S, dy * S, dw * S, dh * S); };
  if (ins.prev >= 0 && ins.xf < 1) draw(ins.imgs[ins.prev], 1);
  draw(ins.imgs[ins.cur], ins.prev >= 0 ? cineEase(ins.xf) : 1);
  X.imageSmoothingEnabled = false;
  X.restore();
}
// anime cut-in: a slanted dark band with the speaker's eyes, sliding in from the right, speed lines behind
function drawCineCut(c) {
  const t = c.t, inK = cineEase(Math.min(1, t / 9)), outK = t > c.T - 9 ? Math.max(0, (c.T - t) / 9) : 1, a = Math.min(inK, outK);
  const y = 112, h = 78, slide = (1 - inK) * 220;
  X.save(); X.globalAlpha = a;
  X.beginPath(); X.moveTo((0 + slide) * S, (y + 10) * S); X.lineTo((W + slide) * S, (y - 8) * S); X.lineTo((W + slide) * S, (y + h - 10) * S); X.lineTo((0 + slide) * S, (y + h + 8) * S); X.closePath();
  X.fillStyle = '#100b0e'; X.fill(); X.clip();
  X.strokeStyle = 'rgba(245,236,216,.16)'; X.lineWidth = S;   // speed lines
  for (let i = 0; i < 14; i++) { const ly = y + hash(i, 21) * h, lx = ((t * 14 + hash(i, 22) * W * 2) % (W + 200)) - 100; X.beginPath(); X.moveTo((W - lx) * S, ly * S); X.lineTo((W - lx + 60 + hash(i, 23) * 80) * S, (ly - 3) * S); X.stroke(); }
  const img = c.img, pw = 300, ph = img.height * pw / img.width, ey = 0.36;   // the eyes sit at about a third of the portrait's height
  X.imageSmoothingEnabled = true; X.drawImage(img, (W - pw - 40 + slide * 0.6) * S, (y + h / 2 - ph * ey) * S, pw * S, ph * S); X.imageSmoothingEnabled = false;
  X.restore();
  X.save(); X.globalAlpha = 0.9 * a; X.fillStyle = UI.seal;
  X.fillRect(slide * S, (y + 9) * S, W * S, 1.5 * S); X.fillRect(slide * S, (y + h + 6) * S, W * S, 1.5 * S); X.restore();
}
// the story-item moment (12g): the scene dims, a hanging scroll unrolls, the item (its illustration, or an ensō until Ash's image
// exists), its name, one line of what it means, then the vermilion seal of where it went
function drawKeepsake(kp) {
  const t = kp.t, out = kp.out ? Math.max(0, 1 - kp.out / 18) : 1;
  X.save(); X.globalAlpha = out;
  X.fillStyle = `rgba(8,5,6,${Math.min(0.62, t / 30)})`; X.fillRect(0, 0, W * S, H * S);
  const w = 236, PH = 254, hh = PH * cineEase(Math.min(1, Math.max(0, t - 6) / 30)), x = 320 - w / 2, y = 52;
  if (hh > 2) {
    X.save(); X.beginPath(); X.rect(x * S, y * S, w * S, hh * S); X.clip();
    X.imageSmoothingEnabled = true; X.drawImage(uiPage(), 0, 0, W * S, H * S, x * S, y * S, w * S, PH * S); X.imageSmoothingEnabled = false;
    X.strokeStyle = 'rgba(42,32,24,.5)'; X.lineWidth = 1.4 * S; X.strokeRect((x + 8) * S, (y + 8) * S, (w - 16) * S, (PH - 16) * S);
    const ia = Math.max(0, Math.min(1, (t - 26) / 24));
    if (kp.img) {   // Ash's illustration, its own paper levelled to white (make step below): multiplied onto the scroll, only the ink and colour show
      const s = Math.min(170 / kp.img.width, 124 / kp.img.height), iy = y + 74 + (1 - ia) * 6;
      X.globalAlpha = out * ia; X.globalCompositeOperation = 'multiply'; X.imageSmoothingEnabled = true;
      X.drawImage(kp.img, (320 - kp.img.width * s / 2) * S, (iy - kp.img.height * s / 2) * S, kp.img.width * s * S, kp.img.height * s * S);
      X.imageSmoothingEnabled = false; X.globalCompositeOperation = 'source-over'; X.globalAlpha = out;
    }
    else drawEnso(kp, 320, y + 76, 46, Math.max(0, Math.min(1, (t - 24) / 40)));
    X.globalAlpha = out * Math.max(0, Math.min(1, (t - 44) / 20));
    headTxt(kp.name, 320, y + 140, UI.ink, 15, 'center', 700, null);
    if (kp.line) wrap(kp.line, w - 44, 11, true).slice(0, 3).forEach((l, i) => headTxt(l, 320, y + 164 + i * 15, UI.soft, 11, 'center', 500, null));
    X.globalAlpha = out;
    X.restore();
    themeUI('scrollRods')(x, y, w, hh);   // the hanging scroll's rods (the theme's)
  }
  if (kp.stamped) {
    const st = t - 74, k = st < 8 ? 2.2 - st / 8 * 1.2 : 1, sx = x + w - 44, sy = y + PH - 44;   // the seal in the bottom corner, under the text
    X.save(); X.globalAlpha = out * Math.min(1, st / 4); X.translate((sx + 12) * S, (sy + 12) * S); X.scale(k, k); X.translate(-(sx + 12) * S, -(sy + 12) * S);
    uiStamp(sx, sy, 24, kp.dest === 'Chronicle' ? '記' : '形', -0.08);
    X.restore();
    X.globalAlpha = out * Math.min(1, st / 10); headTxt(kp.dest || 'Keepsakes', sx - 6, sy + 7, UI.seal, 10, 'right', 700, null);
  }
  if (t > 96 && !kp.out) moreMark(320, y + PH + 12);
  X.restore();
}
// an ensō (e.g. dry brush), drawn stroke by stroke into a cached canvas as `p` (0..1) grows: the placeholder for an item without its picture
function drawEnso(kp, cx, cy, r, p) {
  if (!kp.ens) { kp.ens = mk(r * 2 * S + 40 * S, r * 2 * S + 40 * S); kp.ensN = 0; kp.ensR = mulberry(77); }
  const [c, g] = kp.ens, N = 44, o = r * S + 20 * S;
  g.imageSmoothingEnabled = true;
  while (kp.ensN < Math.floor(p * N)) {
    themeUI('enso')(g, o, r * S, kp.ensN++, N, kp.ensR);   // job fw-F4: one arc in the theme's brush (e.g. dry sumi)
  }
  X.imageSmoothingEnabled = true; X.drawImage(c, cx * S - o, cy * S - o); X.imageSmoothingEnabled = false;
}

// Job fw-F3a: the cinema layer's places in the story-step table and the painted scene (01a_game.js). Its steps are asked before
// every other step; its sparks draw over the actors and its small lights join the lighting pass.
defineStep('cinema', { owner: 'core', order: 100, run: s => cineStep(s) });
defineLayer('world', 'cinema.sparks', { owner: 'core', order: 300, fn: () => cineWorld() });
defineLayer('lights', 'cinema.lights', { owner: 'core', order: 200, fn: (lights, cx, cy) => cineLights(lights, cx, cy) });
