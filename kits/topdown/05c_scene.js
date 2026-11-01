// ============================================================
//  Painted scenes (FF7-style): one hand-painted image per
//  screen + invisible layers: walkable area, blocks, occluder
//  cut-outs with a baseline, doors, exits, examinable things, lights.
//  All geometry is authored in the painting's own pixel space.
// ============================================================
// the game's painted scenes: registered as the content kind `scenes` by the game; the editor's scene JSON (assets/game/*.scene.json) is merged in below
const SCENES = {};

const SC = { def: null, k: 1, mask: null, occ: [], hero: null, leaves: [], layers: false, id: null, ww: W, wh: H, cam: { x: 0, y: 0 } };
// scenes authored in the editor (assets/game/*.scene.json) are merged in here
if (typeof SCENE_JSON === 'object') Object.assign(SCENES, SCENE_JSON);
const SC_SPEED = 1.35, SC_HERO_K = 1.5; // hero rendered at 1.5x unit scale, drawn at half size = 0.75 of the old size at 2x detail

function enterScene(id, at) {
  if (typeof mapClipReset === 'function') mapClipReset();   // Job 18c
  if (typeof fsArtReset === 'function') fsArtReset();
  // Job 8g-r4: a scene may carry flag-gated variants (scene JSON `alt`: [{ when: '<G.f flag>', img, occ }]). The first variant whose flag is set
  // replaces the painting and its cut-outs (e.g. the west road with the barricade gate open once the boss has fallen); walk, exits and the rest stay.
  // A variant whose painting is missing falls back to the base scene.
  const base = SCENES[id], alt = (base.alt || []).find(a => G.f && G.f[a.when] && assetImg(a.img));
  const def = alt ? Object.assign({}, base, alt, { when: undefined, alt: undefined }) : base, img = assetImg(def.img); if (!img) { console.warn('scene image missing', id); return; }
  // world scale: def.tiles = [w, h] in 32px tiles (scrolling scenes); otherwise the painting is exactly one screen
  const k = def.tiles ? def.tiles[0] * T / def.iw : W / def.iw;
  const ww = Math.round(def.iw * k), wh = Math.round(def.ih * k);
  Object.assign(SC, { def, id, k, img, occ: [], leaves: [], ww, wh, water: def.water || [] });
  // Job 9c: looping water video clips baked to sprite sheets (make_water.py): scene JSON `waterLoops`, drawn right over the painting
  SC.wl = (def.waterLoops || []).map(e => ({ e, sheet: assetImg(e.src), mask: assetImg(e.mask), c: null, g: null, fi: -1 })).filter(w => w.sheet && w.mask);
  SC.wm = undefined; WATER_RINGS.list = [];   // the reflection / ripple mask is made again for each scene (waterMask)
  // walkable mask at world (logical) resolution
  const [mc, mg] = mk(ww, wh); mg.fillStyle = '#fff';
  for (const poly of def.walk) { mg.beginPath(); poly.forEach(([x, y], i) => i ? mg.lineTo(x * k, y * k) : mg.moveTo(x * k, y * k)); mg.closePath(); mg.fill(); }
  mg.fillStyle = '#000'; for (const poly of (def.nowalk || [])) { mg.beginPath(); poly.forEach(([x, y], i) => i ? mg.lineTo(x * k, y * k) : mg.moveTo(x * k, y * k)); mg.closePath(); mg.fill(); }
  mg.fillStyle = '#000'; for (const [x0, y0, x1, y1] of def.block) mg.fillRect(x0 * k, y0 * k, (x1 - x0) * k, (y1 - y0) * k);
  const md = mg.getImageData(0, 0, ww, wh).data; SC.mask = new Uint8Array(ww * wh); for (let i = 0; i < ww * wh; i++) SC.mask[i] = md[i * 4] > 127 ? 1 : 0;
  SC.maskCanvas = mc;
  // Job 8d: secret pads (scene JSON `secret_walk`, polygons in painting px: the footpath under the bridge, stepping stones in the stream). Each pad has its own mask
  // and is NOT part of SC.mask, so nothing that walks from the start can ever reach one (flood fills, stuck tests, NPCs, followers). The hero walks on pad
  // SC.padOn only after a jump (`jumps`, below) has put him there; SC.padOn = -1 is ordinary ground.
  SC.padOn = -1; SC.hop = null; SC.autoLock = false; SC.push = 0; SC.pushId = null;
  SC.pads = (def.secret_walk || []).map(poly => {   // point-in-polygon over the pad's bounding box (no canvas readback)
    const m = new Uint8Array(ww * wh), xs = poly.map(p => p[0] * k), ys = poly.map(p => p[1] * k);
    const x0 = Math.max(0, Math.floor(Math.min(...xs))), x1 = Math.min(ww - 1, Math.ceil(Math.max(...xs))), y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(wh - 1, Math.ceil(Math.max(...ys)));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      let inside = false; const px = x + 0.5, py = y + 0.5;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if ((ys[i] > py) !== (ys[j] > py) && px < (xs[j] - xs[i]) * (py - ys[i]) / (ys[j] - ys[i]) + xs[i]) inside = !inside;
      if (inside) m[y * ww + x] = 1;
    }
    return m; });
  // occluder cut-outs at full (2x) detail
  const sx = img.width / def.iw;
  for (const o of def.occ) {
    const xs = o.poly.map(p => p[0]), ys = o.poly.map(p => p[1]);
    const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys);
    const oimg = o.src ? (assetImg(o.src) || img) : img, osx = oimg.width / def.iw;   // o.src: a separate cut-out sheet (alpha) in the same pixel space as the painting
    const [c, g] = mk(Math.ceil((x1 - x0) * osx), Math.ceil((y1 - y0) * osx));
    g.beginPath(); o.poly.forEach(([x, y], i) => i ? g.lineTo((x - x0) * osx, (y - y0) * osx) : g.moveTo((x - x0) * osx, (y - y0) * osx)); g.closePath(); g.clip();
    g.drawImage(oimg, -x0 * osx, -y0 * osx);
    const rect = o.poly.length === 4 && o.poly.every(([x, y]) => (x === x0 || x === x1) && (y === y0 || y === y1));
    // axis-aligned pieces are drawn straight from the sheet with the SAME source-to-screen mapping as the painting (1 image px of padding so the
    // bilinear taps at the edges see real neighbours): no second resample, so a cut-out lines up with the painting under it pixel for pixel.
    // (3 Oct 2026: the old path re-rasterised each slice at a fractional offset and stretched it by the ceil() of its size, which made the cut-outs
    // look shifted against the painting the moment the hero walked behind them.)
    let dr = null;
    if (rect) { const pad = 1, ox = Math.max(0, x0 * osx - pad), oy = Math.max(0, y0 * osx - pad), ex = Math.min(oimg.width, x1 * osx + pad), ey = Math.min(oimg.height, y1 * osx + pad);
      dr = { img: oimg, sx: ox, sy: oy, sw: ex - ox, sh: ey - oy, dx: ox / osx * k, dy: oy / osx * k, dw: (ex - ox) / osx * k, dh: (ey - oy) / osx * k }; }
    SC.occ.push({ c, dr, x: x0 * k, y: y0 * k, w: (x1 - x0) * k, h: (y1 - y0) * k, base: o.base * k, name: o.name, poly: o.poly });
  }
  const s = at || def.start;
  SC.hero = { x: s[0] * k, y: s[1] * k, dir: s[2] || 0, moving: false, step: 0, cool: 0 };
  SC.warp = null;
  SC.staged = [];   // Job 14: no companion stays staged from the last scene
  if (typeof followersReset === 'function') followersReset();   // only a follower walks behind him; companions are staged for the beats that need them
  if (typeof storyEnter === 'function') storyEnter(id);   // NPCs, fog and music of the story (05d_story.js)
  SC.lastTrig = scTriggerAt(); // arriving inside a trigger (the way back of a two-way warp) does not fire it; step out and in again
  G.state = 'scene'; G.map = null;
  sceneCamera(true);
}
// camera follows the hero, clamped to the painting; a painting smaller than the screen is centred
function sceneCamera(snap) {
  if (typeof CINE === 'object' && CINE.cur) { cineView(); return; }   // Job 13: a cinema shot holds the camera (05l_cinema.js)
  const h = SC.hero, c = SC.cam;
  let fx = h.x, fy = h.y, ease = 0.12;
  const cf = typeof ST === 'object' && ST.cam;   // Job 9: a story step may point the camera at a place or an NPC (05d_story.js)
  if (cf) { if (cf.npc) { const n = scNpc(cf.npc); if (n) { fx = n.x; fy = n.y; } } else { fx = cf.x; fy = cf.y; } ease = ST.camEase; }
  const tx = SC.ww <= W ? (SC.ww - W) / 2 : clamp(fx - W / 2, 0, SC.ww - W);
  const ty = SC.wh <= H ? (SC.wh - H) / 2 : clamp(fy - H / 2 - 12, 0, SC.wh - H);
  if (snap) { c.x = tx; c.y = ty; return; }
  c.x += (tx - c.x) * ease; c.y += (ty - c.y) * ease;
  if (Math.abs(tx - c.x) < 0.05) c.x = tx; if (Math.abs(ty - c.y) < 0.05) c.y = ty;
}
const scWalk = (x, y) => { x = Math.round(x); y = Math.round(y); if (!(x >= 0 && y >= 0 && x < SC.ww && y < SC.wh)) return false; const i = y * SC.ww + x; return SC.mask[i] === 1 || (SC.padOn >= 0 && SC.pads[SC.padOn][i] === 1); };
// scene JSON `heroK` (default 1): hero sprite, shadow, feet probes and speed scale together (rooms, where the painting is one screen and the hero would read tiny)
const scHK = () => (SC.def && SC.def.heroK) || 1;
const scFoot = (x, y) => { const f = scHK(); return scWalk(x - 4 * f, y) && scWalk(x + 4 * f, y) && scWalk(x, y - 2 * f) && scWalk(x, y + 1 * f) && !(SC.npcs && SC.npcs.length && scNpcBlocks(x, y)); };
const scIn = (r, x, y) => { const k = SC.k; return x >= r[0] * k && x <= r[2] * k && y >= r[1] * k && y <= r[3] * k; };

// ---------------- warps: step on a trigger, wait, play a sound and an animation, arrive somewhere else ----------------
// A warp is { r, name, to ('' = this scene), at [x, y, facing] (facing 0 down 1 up 2 left 3 right 4 keep), delay (s), sfx, anim, time (s), pair }.
// Two-way warps are simply two warps, each one's arrival point inside or beside the other. Exits that name a scene use the same machinery.
const WARP_ANIMS = ['fade', 'white', 'iris', 'wipe', 'cut'], WARP_SFX = ['none', 'door', 'stairs', 'warp', 'echo', 'step'];
// a door / exit / warp may carry `when`: a G.f flag name, or '!name' for 'while the flag is NOT set' (21 Oct 2026: the west gate's two exits)
const scTrigOn = t => !t.when || (t.when[0] === '!' ? !(G.f && G.f[t.when.slice(1)]) : !!(G.f && G.f[t.when]));
function scTriggerAt() {
  const h = SC.hero, def = SC.def; if (!h || !def) return null;
  for (const t of [...(def.doors || []), ...(def.exits || []), ...(def.warps || []).map(w => (w.warp = true, w))]) if (scIn(t.r, h.x, h.y) && scTrigOn(t)) return t;
  return null;
}
function startWarp(t) {
  const h = SC.hero, fr = v => Math.max(0, Math.round((+v || 0) * 60));
  const anim = WARP_ANIMS.includes(t.anim) ? t.anim : 'fade', total = anim === 'cut' ? 0 : fr(t.time == null ? 0.35 : t.time);
  SC.warp = { t, anim, ph: fr(t.delay) ? 'delay' : 'out', n: 0, dN: fr(t.delay), oN: Math.ceil(total / 2), iN: Math.floor(total / 2), a: 0 };
  h.moving = false; if (t.sfx && t.sfx !== 'none') sfx(t.sfx);
}
function warpUpdate() {
  const w = SC.warp, h = SC.hero; h.moving = false; w.n++;
  if (w.ph === 'delay') { if (w.n >= w.dN) { w.ph = 'out'; w.n = 0; } w.a = 0; if (w.ph === 'delay') return; }
  if (w.ph === 'out') {
    w.a = w.oN ? Math.min(1, w.n / w.oN) : 1;
    if (w.n >= w.oN) { warpArrive(w.t); w.ph = 'in'; w.n = 0; w.a = w.iN ? 1 : 0; if (!w.iN) SC.warp = null; }
    return;
  }
  if (w.ph === 'in') { w.a = 1 - Math.min(1, w.n / w.iN); if (w.n >= w.iN) SC.warp = null; }
}
function warpArrive(t) {
  const to = t.to || SC.id, at = t.at && t.at.length >= 2 ? t.at : null, h = SC.hero, dir = at && at[2] != null && at[2] < 4 ? at[2] : h.dir;
  const keep = SC.warp;
  if (to === SC.id) {
    if (t.jump) SC.padOn = t.jump.toPad == null ? -1 : t.jump.toPad;   // a fade jump (Job 8d): the pad he lands on has to be set before he is placed
    if (at) { h.x = at[0] * SC.k; h.y = at[1] * SC.k; } h.dir = dir; scUnstick(); sceneCamera(true); SC.lastTrig = scTriggerAt(); h.cool = 20;
    if (t.jump) { SC.autoLock = true; SC.hopCool = 24; if (SC.padOn < 0 && typeof followersReset === 'function') SC.trail = [{ x: h.x, y: h.y }]; }
  } else enterScene(to, at ? [at[0], at[1], dir] : null);
  SC.warp = keep;
}
function drawWarpOverlay() {
  if (typeof storyOverlay === 'function') storyOverlay();   // story white-out (05d_story.js)
  const w = SC.warp; if (!w || !(w.a > 0)) return;
  const a = Math.min(1, w.a), h = SC.hero;
  if (w.anim === 'fade') { X.fillStyle = `rgba(0,0,0,${a})`; X.fillRect(0, 0, W * S, H * S); }
  else if (w.anim === 'white') { X.fillStyle = `rgba(255,252,240,${a})`; X.fillRect(0, 0, W * S, H * S); }
  else if (w.anim === 'wipe') { X.fillStyle = '#000'; if (w.ph === 'out') X.fillRect(0, 0, a * W * S, H * S); else X.fillRect((1 - a) * W * S, 0, a * W * S, H * S); }
  else if (w.anim === 'iris') {
    const cx = (h.x - SC.cam.x) * S, cy = (h.y - 12 - SC.cam.y) * S, R = Math.hypot(W, H) * S, r = (1 - a) * R;
    X.fillStyle = '#000'; X.beginPath(); X.rect(0, 0, W * S, H * S); X.arc(cx, cy, Math.max(0, r), 0, Math.PI * 2, true); X.fill('evenodd');
  }
}

// ---------------- jumps: the rock-hop secret (Job 8d, 19 Oct 2026) ----------------
// Scene JSON `jumps`: [{ id, r: [x0, y0, x1, y1] trigger rectangle in painting px, pad: the pad the hero must be standing on (-1 = ordinary ground, default),
//   to: [x, y, facing] landing spot (painting px), toPad: the pad it lands on (-1 = ordinary ground), face: 0 down 1 up 2 left 3 right (which way he must face
//   when two jumps share a rectangle), height: arc peak in logical px, fade: 1 = no arc: the screen fades out and in with him already at the landing (time: seconds, default 0.5), auto: 1 = fires when he walks into the rectangle, otherwise Z, text: shown once the
//   first time (a line of narration), hint: [x, y] a faint sparkle until the jump has been used, tell: 1 shows the "?" bubble before the jump has been used (always on the stones), face omitted = any facing for Z, hold: frames a held direction toward the landing takes to fire a push jump (default 10; push: 0 = Z only) }]. Jumps are one-way; the way back is another jump.
// `padHome` [x, y, facing]: where a save made on a pad puts him back (the way a pad is entered). Pads: see enterScene.
const scJumps = () => SC.def && SC.def.jumps || [];
const scJumpIn = j => scIn(j.r, SC.hero.x, SC.hero.y) && (j.pad == null ? -1 : j.pad) === SC.padOn;
function scJumpFind() {   // the jump Z would take now, or null
  if (SC.hopCool > 0) return null;   // just landed: a Z that closed a line or was mashed on landing does not hop again
  const here = scJumps().filter(j => !j.auto && scJumpIn(j)); if (!here.length) return null;
  return here.find(j => j.face == null || j.face === SC.hero.dir) || null;   // he must face the way he wants to go (the east ledge also has a cache to examine)
}
function scJumpStart(j) {
  const h = SC.hero, k = SC.k, x1 = j.to[0] * k, y1 = j.to[1] * k, d = Math.hypot(x1 - h.x, y1 - h.y);
  h.moving = false; G.f['jump_' + j.id] = 1; SC.push = 0;
  // fade: 1 = no arc, the screen fades out and back in with him already at the landing (the way up behind the bridge: an arc there ran through the foreground and clipped)
  if (j.fade) { startWarp({ to: SC.id, at: j.to, anim: 'fade', time: j.time == null ? 0.5 : j.time, sfx: 'step', jump: j }); return; }
  const dx = x1 - h.x, dy = y1 - h.y; h.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : (dy < 0 ? 1 : 0);
  SC.hop = { j, n: 0, N: clamp(Math.round(d / 2) + 14, 24, 56), x0: h.x, y0: h.y, x1, y1, lift: 0, peak: (j.height || 14) + d * 0.08 };
  if ((h.dir === 2 || h.dir === 3) && typeof mapClipPlay === 'function') mapClipPlay(h, 'story_rock_hop', { time: SC.hop.N });   // Job 18c (S07): the drawn hop; the engine arc still moves him and shrinks his shadow (the strip's own lift is not added: 05n mapClipHeroDraw)
  sfx('step');
}
function scJumpGo(j) {   // a jump with a first-time line plays it, then hops
  if (j.text && !G.f['seen_jump_' + j.id]) { G.f['seen_jump_' + j.id] = 1; SC.hero.moving = false; run([...(typeof j.text === 'string' ? [['', j.text]] : j.text), () => scJumpStart(j)]); }   // text: a string, or a list of [who, line]
  else scJumpStart(j);
}
// Companions do not hop with him: since Job 14 they are not on the map at all (only a follower trails).
const scGroundAt = (x, y, pad) => { x = Math.round(x); y = Math.round(y); if (!(x >= 0 && y >= 0 && x < SC.ww && y < SC.wh)) return false; const i = y * SC.ww + x; return pad >= 0 ? !!(SC.pads[pad] && SC.pads[pad][i] === 1) : SC.mask[i] === 1; };
function scHopUpdate() {
  const hp = SC.hop, h = SC.hero; hp.n++; const t = Math.min(1, hp.n / hp.N);
  h.x = hp.x0 + (hp.x1 - hp.x0) * t; h.y = hp.y0 + (hp.y1 - hp.y0) * t; hp.lift = 4 * hp.peak * t * (1 - t); h.moving = false;
  sceneCamera();
  if (hp.n >= hp.N) {
    const j = hp.j; h.x = hp.x1; h.y = hp.y1; h.dir = j.to[2] != null ? j.to[2] : h.dir; SC.padOn = j.toPad == null ? -1 : j.toPad; SC.hop = null; h.cool = 20;
    SC.autoLock = true; SC.hopCool = 24; SC.lastTrig = scTriggerAt(); sfx('step');
    if (SC.padOn < 0 && typeof followersReset === 'function') { SC.trail = [{ x: h.x, y: h.y }]; }   // back on the ordinary ground: the party walks over to him
    if (!scFoot(h.x, h.y)) console.warn('jump', j.id, 'lands off the ground');
  }
}

function sceneUpdate() {
  const h = SC.hero, def = SC.def;
  if (typeof storyUpdate === 'function') storyUpdate();   // waits, fog, white-out, NPC walks (05d_story.js)
  if (G.state !== 'scene') return;                        // a story step changed state (battle, card)
  if (G.fadeDir) return;
  if (SC.warp) { warpUpdate(); return; }
  if (SC.hop) { scHopUpdate(); return; }   // Job 8d: mid-hop, no input
  if (Script.active) {   // cutscene: the hero waits
    h.moving = false; sceneCamera();
    // Job 8g-r4: during a scripted hero walk ({ heroWalk }, 05d) the party walks his trail with him (e.g. through the open west gate)
    if (typeof ST === 'object' && ST.hw && typeof followersUpdate === 'function' && SC.padOn < 0) followersUpdate();
    return;
  }
  if (typeof storyIdle === 'function' && storyIdle()) { h.moving = false; return; }
  if (btn('start') && !window.SCENE_TEST) { openMenu(); return; }
  if (h.cool > 0) h.cool--;
  if (SC.hopCool > 0) SC.hopCool--;
  if (!scFoot(h.x, h.y)) scUnstick();
  let dx = 0, dy = 0;
  const hd = k => held(k) || btn(k);
  if (hd('left')) dx--; if (hd('right')) dx++; if (hd('up')) dy--; if (hd('down')) dy++;
  if (dx || dy) {
    const sp = SC_SPEED * scHK() * (held('b') ? 1.8 : 1) / (dx && dy ? Math.SQRT2 : 1);
    h.dir = Math.abs(dy) > 0 && !dx ? (dy < 0 ? 1 : 0) : dx < 0 ? 2 : dx > 0 ? 3 : h.dir;
    if (dx && dy) h.dir = dy < 0 ? 1 : 0;
    // move each axis on its own; if one is blocked by a sloped or jagged edge, nudge sideways
    // (up to ~2x the step) so the hero slides along it instead of snagging
    let moved = false;
    const go = (x, y) => scFoot(x, y) ? (h.x = x, h.y = y, true) : false;
    const nudge = (fn) => { for (let d = 0.5; d <= sp * 2.2; d += 0.5) if (fn(d) || fn(-d)) return true; return false; };
    // corner assist: blocked head-on, look sideways (up to ~2/3 of a tile) for the nearest way around
    // and step toward it, so the hero rounds plinth corners, troughs and barrels by himself
    const assist = (ax, ay) => { // ax,ay: the blocked step; returns true if it stepped sideways
      for (let d = 1; d <= 22; d++) for (const s of [1, -1]) {
        const ox = ay ? s * d : 0, oy = ax ? s * d : 0;
        if (!scFoot(h.x + ax + ox, h.y + ay + oy)) continue;
        let clear = true; for (let i = 1; i <= d; i++) if (!scFoot(h.x + (ox ? Math.sign(ox) * i : 0), h.y + (oy ? Math.sign(oy) * i : 0))) { clear = false; break; }
        if (clear) return go(h.x + Math.sign(ox) * Math.min(sp, d), h.y + Math.sign(oy) * Math.min(sp, d));
      }
      return false;
    };
    // a blocked step falls back to a half and a quarter step, so the hero walks right up to an edge (10 Oct 2026: a whole step that would
    // cross the walk mask's edge used to be dropped, leaving him up to one step short of an exit strip that lies on that edge)
    const part = (ax, ay) => go(h.x + ax / 2, h.y + ay / 2) || go(h.x + ax / 4, h.y + ay / 4);
    if (dx) { const nx = h.x + dx * sp; if (go(nx, h.y) || (!dy && (nudge(d => go(nx, h.y + d)) || assist(dx * sp, 0))) || part(dx * sp, 0)) moved = true; }
    if (dy) { const ny = h.y + dy * sp; if (go(h.x, ny) || (!dx && (nudge(d => go(h.x + d, ny)) || assist(0, dy * sp))) || part(0, dy * sp)) moved = true; }
    if (!moved && dx && dy) moved = go(h.x + dx * sp, h.y) || go(h.x, h.y + dy * sp);
    h.moving = moved; if (moved) h.step += held('b') ? 1.6 : 1;
    if (!moved && frame % 20 === 0) sfx('bump');
  } else { h.moving = false; if (btn('a')) sceneInteract(); }
  sceneCamera();
  if (typeof followersUpdate === 'function' && SC.padOn < 0) followersUpdate();   // the party waits where he left them while he is on the stones (Job 8d)
  // auto jumps (a way back up behind the bridge): fire when he walks into the rectangle; re-armed once he has left every auto rectangle
  { const aj = scJumps().find(j => j.auto && scJumpIn(j)); if (!aj) SC.autoLock = false; else if (!SC.autoLock && !h.cool && dx | dy) { SC.autoLock = true; scJumpGo(aj); return; } }
  // push jumps (19 Oct 2026, after Ash could not land the stones with Z and an exact facing): inside a jump's rectangle, hold any direction that points
  // roughly at the landing (within about 60 degrees, so a diagonal or a plain arrow both work) for a moment and he hops. No button, no facing needed, and it
  // works while he is pressed against the edge. `hold` = frames (default 10, the gap in the fence 24 so walking past it does not drop him), `push: 0` turns it off.
  if (!SC.hop) {
    let pj = null, best = 0.5;
    if ((dx || dy) && !SC.hopCool) for (const j of scJumps()) {
      if (j.auto || j.push === 0 || !scJumpIn(j)) continue;
      const vx = j.to[0] * SC.k - h.x, vy = j.to[1] * SC.k - h.y, c = (dx * vx + dy * vy) / (Math.hypot(dx, dy) * Math.hypot(vx, vy) || 1);
      if (c > best) { best = c; pj = j; }
    }
    if (!pj) SC.push = 0;
    else { SC.push = SC.pushId === pj.id ? (SC.push || 0) + 1 : 1; SC.pushId = pj.id; if (SC.push >= (pj.hold || 10)) { SC.push = 0; scJumpGo(pj); return; } }
  }
  // doors and exits trigger when the hero steps INTO them (not while he is standing in one). An exit with `to`
  // moves to another scene (t.at = [x, y, dir] in that scene's painting pixels); otherwise it shows its text and
  // moves the hero back onto walkable ground just outside the trigger.
  let inside = scTriggerAt();
  if (inside && inside !== SC.lastTrig && !h.cool) {
    SC.lastTrig = inside; h.cool = 40; let t = inside;
    const ov = typeof storyExit === 'function' ? storyExit(t) : null;   // the story may redirect or block an exit
    if (Array.isArray(ov)) { scPushOut(t.r); run(ov); return; }
    if (ov) t = ov;
    if (t.to && SCENES[t.to] || (t.warp && !t.to)) { startWarp(t); return; }   // an exit with a scene, or any warp (blank scene = this one)
    openDialog(t.who || '', t.warp ? (t.text || 'The way is closed.') : t.text || '');
    scPushOut(t.r);
    return;
  }
  if (!inside) SC.lastTrig = null;
}
// nearest spot on walkable ground just outside a trigger rectangle, preferring the direction away from its centre
function scPushOut(r) {
  const h = SC.hero, k = SC.k, cx = (r[0] + r[2]) / 2 * k, cy = (r[1] + r[3]) / 2 * k;
  const base = Math.atan2(h.y - cy, h.x - cx), out = [];
  for (let i = 0; i < 24; i++) { const a = base + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * Math.PI / 12; out.push(a); }
  for (const d of [10, 8, 12, 6, 16, 22, 30]) for (const a of out) {
    const x = h.x + Math.cos(a) * d, y = h.y + Math.sin(a) * d;
    if (scFoot(x, y) && !scIn([r[0] - 3, r[1] - 3, r[2] + 3, r[3] + 3], x, y)) { h.x = x; h.y = y; return; }
  }
  scUnstick();
}
// safety net: if the hero ever ends up on ground he cannot stand on, move him to the nearest ground he can
function scUnstick() {
  const h = SC.hero; if (scFoot(h.x, h.y)) return;
  for (let d = 1; d <= 120; d++) for (let i = 0; i < 16; i++) {
    const a = i * Math.PI / 8, x = h.x + Math.cos(a) * d, y = h.y + Math.sin(a) * d;
    if (scFoot(x, y)) { h.x = x; h.y = y; return; }
  }
}
function sceneProbe() {
  const h = SC.hero, d = [[0, 10], [0, -12], [-12, -3], [12, -3]][h.dir], f = scHK();
  return [h.x + d[0] * f, h.y + d[1] * f];
}
function sceneTarget() {
  const [px, py] = sceneProbe();
  const n = typeof scNpcAt === 'function' ? scNpcAt(px, py) : null; if (n) return { npc: n };
  const sp = typeof storySpot === 'function' ? storySpot(px, py) : null; if (sp) return spotLive(sp) ? { spot: sp } : null;   // story spots (05d)
  const th = SC.def.things.find(t => scIn(t.r, px, py)); if (th) return th;
  const fo = typeof followerAt === 'function' ? followerAt(px, py) : null; return fo ? { follower: fo } : null;   // a companion, when nothing else is there (05g)
}
function sceneInteract() { const j = scJumpFind(); if (j) { scJumpGo(j); return; } const t = sceneTarget(); if (!t) return; if (t.npc) npcTalk(t.npc); else if (t.follower) followerTalk(t.follower); else if (t.spot) spotTalk(t.spot); else openDialog(t.who || '', t.text); }

// ---------------- parallax backgrounds (3 Oct 2026) ----------------
// Scene JSON key `parallax`: [{ img, fx, fy, alpha }] drawn far to near, BEHIND the painting, in screen space. The painting must have alpha
// where the layers should show through (the battlefield's sky and valley notch). A layer travels fx / fy of the camera's travel: the layer is
// scaled just big enough to cover W + (world width - W) * fx by H + (world height - H) * fy and moved fx / fy as fast as the camera does (its top-left
// sits at the screen's top-left when the camera is at the start), so 0 = pinned to the screen (a sky), 1 = moves with the ground. alpha (optional) fades a layer.
// where a parallax layer sits on screen ([x, y, w, h]) with the camera at (camX, camY); null until its image has loaded. A fight on the
// scene draws the same layers behind its zoomed window (07b battleSceneView, job battle-place: the battlefield's sky was black there).
function parallaxRect(l, camX, camY) {
  const im = assetImg(l.img); if (!im) return null;
  const trx = Math.max(0, SC.ww - W), try_ = Math.max(0, SC.wh - H);
  const cax = trx ? clamp(camX, 0, trx) : 0, cay = try_ ? clamp(camY, 0, try_) : 0;
  const fx = l.fx == null ? 0.2 : l.fx, fy = l.fy == null ? 0.2 : l.fy;
  const dw = W + trx * fx, dh = H + try_ * fy, s = Math.max(dw / im.width, dh / im.height); // just big enough to cover the whole camera travel
  const lw = l.aligned ? SC.ww : im.width * s, lh = l.aligned ? SC.wh : im.height * s;
  // Registered road plates retain the painting's scale, aligned at the camera midpoint, with overscan on either side.
  const x = -Math.round((cax * fx + (l.aligned ? trx*(1-fx)/2 : 0)) * 2) / 2,
    y = -Math.round((cay * fy + (l.aligned ? try_*(1-fy)/2 : 0)) * 2) / 2;
  return [x, y, lw, lh, im];
}
function drawParallax() {
  const def = SC.def, P = def.parallax; if (!P || !P.length) return;
  L.fillStyle = def.bg || '#241a2c'; L.fillRect(0, 0, W, H);
  for (const l of P) {
    const r = parallaxRect(l, SC.cam.x, SC.cam.y); if (!r) continue;
    const [x, y, lw, lh, im] = r;
    if (l.alpha != null) L.globalAlpha = l.alpha;
    L.drawImage(im, x, y, lw, lh);
    if (l.waterShimmer) drawWaterShimmer(im, l.waterShimmer, x, y, lw, lh);
    L.globalAlpha = 1;
  }
}
// Character visibility (10 Oct 2026, Ash: 'make all the characters a tad brighter, so you can more readily see them'): every character in a painted
// scene is drawn with a 1-art-pixel dark outer outline (a cached dilated silhouette under the sprite) and an additive lift on top of the sprite, so it
// stays readable after the dusk grade multiplies the scene down. Foreground cut-outs drawn afterwards still cover it. SC.pop = false turns it off.
const POP_OL = new WeakMap();
function popOutline(s) {
  let c = POP_OL.get(s); if (c) return c;
  const q = s.q || 1, [cc, g] = mk(s.width + 2 * q, s.height + 2 * q);   // the outline is 1 art px thick, q sprite px on a hi-res sheet
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.drawImage(s, q + dx * q, q + dy * q);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = '#160e14'; g.fillRect(0, 0, cc.width, cc.height);
  POP_OL.set(s, cc); return cc;
}
let POP_LIFT = 0.12;
function popSprite(g, s, x, y, w, h, a = 1) {
  if (SC.pop === false) { g.globalAlpha = a; drawSpr(g, s, x, y, w, h); g.globalAlpha = 1; return; }
  const q = s.q || 1, k = w / s.width * q, hi = q > 1;
  if (hi) { g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; }
  g.globalAlpha = 0.6 * a; g.drawImage(popOutline(s), x - k, y - k, w + 2 * k, h + 2 * k);
  g.globalAlpha = a; g.drawImage(s, x, y, w, h);
  g.globalCompositeOperation = 'lighter'; g.globalAlpha = POP_LIFT * a; g.drawImage(s, x, y, w, h);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  if (hi) g.imageSmoothingEnabled = false;
}
// ---------------- the painted scene's draw-layer slots (job fw-F3a; the registry is LAYERS in 01a_game.js) ----------------
// drawScene names no game hook: kits, systems and the game fill these slots with defineLayer(slot, id, { owner, order, fn }).
// In the order drawScene uses them:
const SCENE_SLOTS = {
  grade: 'folded: fn(tod) returns the grade { key: day | dusk | night | dawn, amb, tint, a } (starts neutral daylight; the game sets its light)',
  shake: 'summed: fn() returns a camera offset [dx, dy] in logical px',
  zoom: 'multiplied: fn() returns a world scale about the screen centre',
  backdrop: 'world space, over the painting and under the actors: fn(cx, cy, ix)',
  hero: 'every entry is asked: fn(hero, hk) returns a draw function to use instead of the walking sprite, or null; the first one wins',
  npc: 'fn(npc, hk) returns true when it drew the NPC itself',
  actors: 'fn(acts, hk) pushes { y, f } entries into the depth-sorted actor list',
  occluder: 'fn(ctx, occluder, ox, oy) returns true when it drew the cut-out itself (the main pass and the hero-silhouette pass)',
  world: 'world space, over the actors and the cut-outs: fn(cx, cy)',
  screen: 'screen space, before the lighting: fn(tod, cx, cy)',
  lights: 'fn(lights, cx, cy, tod) adds screen-space lights for the lighting pass',
  graded: 'after the grade and its tint, before the vignette: fn(tod, cx, cy)',
  top: 'after the vignette: fn(cx, cy, tod)',
};
// The dawn grade (cool lavender shadows, a rose-gold wash from the upper left), a in 0..1 over the ambient colour amb. One function for the
// painted scenes' grade slot (e.g. a wake-up) and the title's first light (02e_scenes.js drawRiverTitleArt), so the two never
// drift (job fw-F4, from the title-river-art lessons). gradeTint paints a grade's warm wash over g (logical px), as drawScene does.
const dawnGrade = (amb, a) => ({ key: 'dawn', amb: mixHex(amb, '#b4b8dc', a), tint: `rgba(255,176,138,${(0.08 + 0.2 * a).toFixed(3)})`, a });
function gradeTint(g, tint) { const gr = g.createLinearGradient(0, 0, W * 0.6, H); gr.addColorStop(0, tint); gr.addColorStop(1, 'rgba(255,190,110,0)'); g.globalCompositeOperation = 'screen'; g.fillStyle = gr; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over'; }
function drawScene() {
  const def = SC.def, h = SC.hero;
  // painted scenes are authored in neutral daylight; the grade slot sets the light (e.g. day or dusk by the story, a rest-stop night,
  // a festival night, a wake-up's dawn)
  let tod = { key: 'day', amb: '#ffffff', tint: null };
  for (const d of layerList('grade')) tod = d.fn(tod) || tod;
  POP_LIFT = tod.key === 'night' ? 0.2 : tod.key === 'dusk' ? 0.4 : tod.key === 'dawn' ? 0.14 + 0.16 * tod.a : 0.14;   // characters lifted more at dusk, where the grade darkens them most
  // camera snapped to the 2x art grid so the painting never shimmers; everything in the world is drawn offset by it
  const shk = [0, 0];
  for (const d of layerList('shake')) { const o = d.fn(); if (o) { shk[0] += o[0]; shk[1] += o[1]; } }   // story shake, the stampede's rumble and impacts (05j)
  const cx = Math.round((SC.cam.x + shk[0]) * D) / D, cy = Math.round((SC.cam.y + shk[1]) * D) / D;
  const ix = SC.img.width / SC.ww; // image px per logical px
  drawParallax();
  L.save();
  let zm = 1;
  for (const d of layerList('zoom')) zm *= d.fn();   // the story's zoom step; the stampede's cover (a shaking screen-sized painting is zoomed in a hair so its edges never show, 05j)
  if (zm !== 1) { L.translate(W / 2, H / 2); L.scale(zm, zm); L.translate(-W / 2, -H / 2); L.imageSmoothingEnabled = true; }
  L.translate(-cx, -cy);
  // only the visible part of the painting is drawn (paintings can be 4K)
  L.drawImage(SC.img, cx * ix, cy * ix, Math.min(W, SC.ww) * ix, Math.min(H, SC.wh) * ix, cx, cy, Math.min(W, SC.ww), Math.min(H, SC.wh));
  drawLayers('backdrop', cx, cy, ix);   // clean plates, water loops, the stampede's far plume, wading rings, low mist, the festival ring
  // hero: shadow, sprite
  const hw = h.moving || h.fieldWalking || !!ST.hw;   // scripted walks animate the legs too
  const hf = hw ? [1, 0, 3, 0][Math.floor(h.step / 7) % 4] : 0, hbob = hw && hf === 0 ? 1 : 0; // passing pose (stand) sits 1px higher than the contact strides
  const s = heroSprite(h.dir, hf, gameHook('heroVariant')) || charSprite(HERO_SPR, h.dir, walkFrame(h), !h.moving && Math.floor(frame / 40) % 2 ? 1 : 0, SC_HERO_K);
  const hk = scHK(), sw = s.width / (2 * (s.q || 1)) * hk, sh = s.height / (2 * (s.q || 1)) * hk, hx = Math.round((h.x - sw / 2) * 2) / 2, hy = Math.round((h.y - sh + 1 - hbob) * 2) / 2;
  // actors (the hero and the story NPCs) and the occluder cut-outs are drawn in order of their ground line, so a cut-out covers
  // whoever stands behind it and an NPC in front of the hero covers him (and the other way round)
  // Job 8d: mid-hop the shadow stays on the ground (smaller and fainter as he rises) and the stand frame is lifted; a short squat at take-off and landing
  const drawHeroHop = () => {
    const hp = SC.hop, lift = hp ? hp.lift : 0, t = hp ? hp.n / hp.N : 0, sq = hp && (t < 0.1 || t > 0.9) ? 0.92 : 1, sc = 1 - Math.min(0.35, lift / 80);
    L.globalAlpha = 0.8 * (hp ? 0.45 + 0.55 * sc : 1); L.drawImage(shadowSprite(18, 6), h.x - 9 * hk * sc, h.y - 3 * hk * sc, 18 * hk * sc, 6 * hk * sc); L.globalAlpha = 1;
    if (sq < 1) popSprite(L, s, hx, hy + sh * (1 - sq), sw, sh * sq); else popSprite(L, s, hx, hy - lift, sw, sh); };
  // the hero slot: the stampede's shove, a map-scale clip, the lantern pose, the wake-up's pose in the mud, sitting by a fire... Every
  // entry is asked (some keep their own clocks), the first draw function wins; otherwise the hop-aware walking sprite
  let drawHero = null;
  for (const d of layerList('hero')) { const f = d.fn(h, hk); if (f && !drawHero) drawHero = f; }
  if (!drawHero && !SC.hop) drawReflection(s, hx, h.y + 1 - hbob, sw, sh);   // his reflection on water below his feet (not mid-hop, not in a story pose)
  drawHero = drawHero || drawHeroHop;
  const drawOcc = o => { if (firstLayer('occluder', L, o, 0, 0)) return; if (o.dr) L.drawImage(o.dr.img, o.dr.sx, o.dr.sy, o.dr.sw, o.dr.sh, o.dr.dx, o.dr.dy, o.dr.dw, o.dr.dh); else L.drawImage(o.c, o.x, o.y, o.w, o.h); };
  const acts = [{ y: h.y, f: drawHero }];
  for (const n of SC.npcs || []) if (!n.hidden && n.alpha > 0) acts.push({ y: n.y, f: () => {
    if (firstLayer('npc', n, hk)) return;   // e.g. a drawn map-scale strip (05n_mapclip.js)
    const [ns, pad] = npcSprite(n), nw = ns.width / (2 * (ns.q || 1)) * hk, nh = ns.height / (2 * (ns.q || 1)) * hk, np = pad / 2 * hk, nb = n.moving && [1, 0, 3, 0][Math.floor(n.step / 7) % 4] === 0 ? 1 : 0;
    L.globalAlpha = 0.8 * n.alpha; L.drawImage(shadowSprite(18, 6), n.x - 9 * hk, n.y - 3 * hk, 18 * hk, 6 * hk);
    if (n.sil) L.filter = 'brightness(0.12) saturate(0.4)';   // Job 13: someone not yet shown, as a dark silhouette
    popSprite(L, ns, Math.round((n.x - nw / 2) * 2) / 2, Math.round((n.y - nh + np + 1 - nb) * 2) / 2, nw, nh, n.alpha); if (n.sil) L.filter = 'none'; } });
  drawLayers('actors', acts, hk);   // foes and sparkles, the stampede, jump hints, the party, the festival's drum tower, a rest-stop fire
  acts.sort((a, b) => a.y - b.y);
  const minY = acts[0].y;
  // occluders in front of someone (their baseline is below that actor's feet); off-screen ones are skipped
  const occs = SC.occ.filter(o => o.base > minY && o.x < cx + W && o.x + o.w > cx && o.y < cy + H && o.y + o.h > cy);
  for (const o of occs) acts.push({ y: o.base, occ: 1, f: () => drawOcc(o) });
  acts.sort((a, b) => a.y - b.y || (a.occ ? 1 : 0) - (b.occ ? 1 : 0));
  for (const a of acts) a.f();
  drawLayers('world', cx, cy);   // field-skill seals, the festival's lantern strings, the cinema's sparks, a veil of mist
  // Hero silhouette behind foreground pieces (4 Oct 2026, Ash: "behind a tree I can't see a silhouette at all ... without it flashing dark and light").
  // The ghost is built per pixel: the foreground pieces that are in front of him, cut to his sprite's shape, filled with one flat tint and laid over them at a
  // fixed low alpha. It exists ONLY where a foreground pixel really covers him, so the visible part of the hero never changes (no darkening, no flash); a short
  // fade (SC.ghostA) keeps a rail or a leaf edge that grazes his foot from blinking. V toggles it (SC.ghost).
  if (SC.ghost !== false) {
    const gx = hx - 2, gy = hy - 2, gw = sw + 4, gh = sh + 4, hit = [];
    for (const o of SC.occ) if (o.base > h.y && o.x < gx + gw && o.x + o.w > gx && o.y < gy + gh && o.y + o.h > gy) hit.push(o);
    // Only when he is really hidden (4 Oct 2026, Ash: "it should only happen when you need it, like the big maple canopy"): the silhouette fades in once
    // nearly all of his body is covered (0.9, was 0.55 which fired behind torii beams, lanterns and rails), so a torii pillar or a rail that hides a slice of him never triggers it. Scene JSON `ghostCover` (0..1,
    // default 0.9) changes the threshold for one area; no extra painted layer is needed.
    let want = 0, tc, tg;
    if (hit.length) {
      const pw = Math.ceil(gw * 2), ph = Math.ceil(gh * 2);
      if (!SC.ghostC || SC.ghostC[0].width !== pw || SC.ghostC[0].height !== ph) SC.ghostC = mk(pw, ph);
      [tc, tg] = SC.ghostC; tg.setTransform(2, 0, 0, 2, 0, 0); tg.clearRect(0, 0, gw, gh);
      tg.globalCompositeOperation = 'source-over';
      for (const o of hit) { if (firstLayer('occluder', tg, o, gx, gy)) continue; if (o.dr) tg.drawImage(o.dr.img, o.dr.sx, o.dr.sy, o.dr.sw, o.dr.sh, o.dr.dx - gx, o.dr.dy - gy, o.dr.dw, o.dr.dh); else tg.drawImage(o.c, o.x - gx, o.y - gy, o.w, o.h); }
      tg.globalCompositeOperation = 'destination-in'; tg.drawImage(s, hx - gx, hy - gy, sw, sh);      // keep only the hero's shape
      // how much of him is covered: opaque pixels left after the cut-out against the sprite's own opaque pixels
      if (!SC.ghostM || SC.ghostM[0].width !== pw || SC.ghostM[0].height !== ph) SC.ghostM = mk(pw, ph);
      const [mc, mg] = SC.ghostM; mg.setTransform(2, 0, 0, 2, 0, 0); mg.clearRect(0, 0, gw, gh); mg.drawImage(s, hx - gx, hy - gy, sw, sh);
      const a = tg.getImageData(0, 0, pw, ph).data, b = mg.getImageData(0, 0, pw, ph).data;
      let ca = 0, cb = 0; for (let i = 3; i < a.length; i += 4) { if (a[i] > 128) ca++; if (b[i] > 128) cb++; }
      const cov = SC.ghostCov = cb ? ca / cb : 0, t0 = SC.def && SC.def.ghostCover != null ? SC.def.ghostCover : 0.9;
      want = cov >= t0 ? 1 : cov <= t0 - 0.1 ? 0 : (cov - (t0 - 0.1)) / 0.1;
    }
    SC.ghostA = (SC.ghostA || 0) + (want - (SC.ghostA || 0)) * 0.3;
    if (hit.length && SC.ghostA > 0.04) {
      tg.globalCompositeOperation = 'source-in'; tg.fillStyle = '#e4f0ff'; tg.fillRect(0, 0, gw, gh);   // one flat tint, whatever is in front of him
      L.globalAlpha = 0.5 * SC.ghostA; L.drawImage(tc, gx, gy, gw, gh); L.globalAlpha = 1;
    }
  }
  L.restore();
  drawLayers('screen', tod, cx, cy);   // the stampede's dust haze, falling leaves, dusk fireflies
  // time of day: grade + lights (world positions converted to screen space); a scene's own lights are lit at dusk
  const k = SC.k, lights = tod.key === 'dusk' ? (def.lights || []).map(([x, y, r, col, flick]) => ({ x: x * k - cx, y: y * k - cy, r: r * k * 1.9, col, flick })) : [];
  drawLayers('lights', lights, cx, cy, tod);   // a rest-stop fire, the cinema's candles, the festival's lanterns and lit windows
  if (zm !== 1) for (const l of lights) { l.x = (l.x - W / 2) * zm + W / 2; l.y = (l.y - H / 2) * zm + H / 2; l.r = Math.round(l.r * zm); }   // Job 13: lights follow a zoomed camera (they were placed as if at zoom 1 and slid while it zoomed)   // Job 8g-r1: the fire's light (and only that, at night)
  lightingPass({ outdoor: false, id: 'scene' }, lights, tod);
  if (lights.length) { // warm bloom on paper windows, lanterns and doorways
    L.globalCompositeOperation = 'lighter';
    for (const l of lights) { const fl = 1 - l.flick * 0.3 + Math.sin(frame / 6 + l.x) * l.flick * 0.2, r = Math.round(l.r * 0.55); L.globalAlpha = 0.42 * fl * (l.bloom == null ? 1 : l.bloom); L.drawImage(glowSprite(r, l.col), l.x - r, l.y - r); }   // l.bloom: Job 8g-r1's fire keeps its bloom low
    L.globalAlpha = 1; L.globalCompositeOperation = 'source-over';
  }
  if (tod.tint) gradeTint(L, tod.tint);
  drawLayers('graded', tod, cx, cy);   // e.g. the dawn's low sun
  L.drawImage(vignette(), 0, 0);
  drawLayers('top', cx, cy, tod);   // notes rising over a singer (after the night grade), drifting fog
  if (SC.layers) { L.save(); L.translate(-cx, -cy); drawSceneLayers(cx, cy); L.restore(); }
}
// Job 9c: water loops (runbook section 11). Each loop is a sprite sheet of art-pixel frames (e.cw x e.ch art px, e.cols per row, e.fps) that
// make_water.py cut from the Seedance clips; it is drawn nearest-neighbour up to the painting's pixel size, cut by its alpha mask (where the
// clip really moves, inside the traced water polygon) and laid over the painting and UNDER the actors and the foreground cut-outs, so a
// bridge, a tree or the hero's feet still cover it. e.x/y/w/h are in painting image px. The dusk / morning grade is applied later over all.
function drawWaterLoops(cx, cy, ix, ctx = L) {   // ctx: the battle draws them into its own canvas (07b drawBattleWater)
  for (const w of SC.wl || []) {
    const e = w.e, dx = e.x / ix, dy = e.y / ix, dw = e.w / ix, dh = e.h / ix;
    if (dx >= cx + W || dx + dw <= cx || dy >= cy + H || dy + dh <= cy) continue;   // off screen
    const fi = Math.floor(frame * e.fps / 60) % e.frames;
    if (fi !== w.fi) {   // rebuild the region only when the 12 fps frame changes
      if (!w.c) [w.c, w.g] = mk(e.w, e.h);
      const g = w.g, r = Math.floor(fi / e.cols), q = fi % e.cols;
      g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, e.w, e.h);
      g.drawImage(w.sheet, q * e.cw, r * e.ch, e.cw, e.ch, 0, 0, e.w, e.h);
      g.globalCompositeOperation = 'destination-in'; g.drawImage(w.mask, 0, 0);
      g.globalCompositeOperation = 'source-over'; w.fi = fi;
    }
    ctx.drawImage(w.c, dx, dy, dw, dh);
  }
}
// Water polish (30 Oct 2026): where the hero's reflection shows and where his feet make rings. The water loops' own masks (where the clip
// really moves, so rock and bank stay dry) plus the scene JSON's `reflect` polygons (still water that has no loop, painting px), drawn once
// per scene into a canvas in scene units (the polygons are one even-odd path, so a polygon inside another cuts a hole); `loop` / `all` are its alpha for quick lookups (rings only on moving water, reflections on both).
function waterMask() {
  if (SC.wm !== undefined) return SC.wm;
  const polys = SC.def.reflect || [];
  if (!(SC.wl || []).length && !polys.length) return (SC.wm = null);
  const ix = SC.img.width / SC.ww, w = SC.ww, h = SC.wh, [c, g] = mk(w, h), alpha = () => { const a = g.getImageData(0, 0, w, h).data, m = new Uint8Array(w * h); for (let i = 0; i < m.length; i++) m[i] = a[i * 4 + 3]; return m; };
  for (const l of SC.wl) g.drawImage(l.mask, l.e.x / ix, l.e.y / ix, l.e.w / ix, l.e.h / ix);
  const loop = alpha(); g.fillStyle = '#fff';
  g.beginPath(); for (const p of polys) { p.forEach(([x, y], i) => i ? g.lineTo(x * SC.k, y * SC.k) : g.moveTo(x * SC.k, y * SC.k)); g.closePath(); }
  g.fill('evenodd');   // one path, even-odd: a polygon inside another is a hole (a rock or a rice tuft standing in the water)
  return (SC.wm = { c, w, h, loop, all: polys.length ? alpha() : loop });
}
const waterAt = (x, y, which = 'all') => { const M = waterMask(); x = Math.round(x); y = Math.round(y); return M && x >= 0 && y >= 0 && x < M.w && y < M.h ? M[which][y * M.w + x] : 0; };
// the hero mirrored under his feet, only where there is water: rows of 1 scene px that sway a little more the further they are from his
// feet, darker, fading out downwards. s = his sprite, drawn at (x, y, sw, sh); foot = the ground line
const REFLECT = { alpha: 0.62, filter: 'brightness(0.86) saturate(0.9)', sway: 0.7 };
function drawReflection(s, x, foot, sw, sh) {
  const M = waterMask(); if (!M) return;
  let hit = false;
  for (let yy = Math.max(0, Math.floor(foot)); yy < Math.min(M.h, foot + sh * 0.7) && !hit; yy += 2) for (let xx = Math.max(0, Math.floor(x)); xx < Math.min(M.w, x + sw); xx += 2) if (M.all[yy * M.w + xx] > 40) { hit = true; break; }
  if (!hit) return;
  const tw = Math.ceil(sw * D), th = Math.ceil(sh * D), rows = Math.ceil(sh);
  if (!SC.reflC || SC.reflC[0].width < tw || SC.reflC[0].height < th) SC.reflC = mk(Math.max(tw, 96), Math.max(th, 160));
  const [c, g] = SC.reflC; g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, c.width, c.height); g.imageSmoothingEnabled = false;
  for (let r = 0; r < rows; r++) {
    const u = r / rows, sy = s.height * (1 - (r + 1) / rows), off = Math.sin(frame * 0.09 + r * 0.55) * REFLECT.sway * D * (0.3 + u);
    g.drawImage(s, 0, sy, s.width, s.height / rows, Math.round(off), r * D, tw, D);
  }
  g.globalCompositeOperation = 'destination-in'; g.drawImage(M.c, x, foot, sw, sh, 0, 0, tw, th);
  const fade = g.createLinearGradient(0, 0, 0, th); fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(0.8, 'rgba(0,0,0,0.7)'); fade.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = fade; g.fillRect(0, 0, tw, th); g.globalCompositeOperation = 'source-over';
  L.save(); L.globalAlpha = REFLECT.alpha; try { L.filter = REFLECT.filter; } catch (e) {}
  L.drawImage(c, 0, 0, tw, th, x, foot, sw, sh); L.restore();
}
// rings where the hero's feet are in moving water (a loop's mask): one every few px of walking, a slow endless ring while he stands
const WATER_RINGS = { list: [], f: -1, d: 0, x: 0, y: 0, s: 1 };
function drawWaterRings() {
  const h = SC.hero, R = WATER_RINGS; if (!h || !waterMask()) return;
  const wet = !SC.hop && waterAt(h.x, h.y, 'loop') > 60;
  if (R.f !== frame) {
    R.f = frame; const dd = Math.hypot(h.x - R.x, h.y - R.y); R.x = h.x; R.y = h.y;
    if (wet && dd < 40) { R.d += dd; if (R.d >= 8) { R.d = 0; R.s = -R.s; R.list.push({ x: h.x + R.s * 3, y: h.y - 1, t: 0 }); } } else R.d = 0;
    for (const r of R.list) r.t++; R.list = R.list.filter(r => r.t < 46);
  }
  const ring = (x, y, rx, a) => {
    if (a <= 0.01) return;
    L.beginPath(); L.ellipse(x, y, rx, rx * 0.36, 0, 0, Math.PI * 2); L.lineWidth = 1.1; L.strokeStyle = `rgba(236,242,250,${Math.min(1, a * 1.15)})`; L.stroke();
    L.beginPath(); L.ellipse(x, y + 0.9, rx, rx * 0.36, 0, 0, Math.PI * 2); L.strokeStyle = `rgba(40,34,44,${a * 0.5})`; L.stroke();
  };
  if (wet && !h.moving) for (let i = 0; i < 3; i++) { const u = ((frame * 0.55 + i * 52) % 156) / 156; ring(h.x, h.y - 1, 9 + u * 12, Math.pow(1 - u, 1.3) * 0.7); }
  for (const r of R.list) { const u = r.t / 46; ring(r.x, r.y, 2.5 + u * 14.5, (1 - u) * 0.9); }
}
function drawSceneLayers(cx, cy) {
  const k = SC.k, def = SC.def;
  L.globalAlpha = 0.3; L.globalCompositeOperation = 'source-over';
  const [tc, tg] = SC.tint || (SC.tint = mk(W, H)); tg.clearRect(0, 0, W, H); tg.globalCompositeOperation = 'source-over';
  tg.drawImage(SC.maskCanvas, cx, cy, W, H, 0, 0, W, H); tg.globalCompositeOperation = 'source-in'; tg.fillStyle = '#30ff70'; tg.fillRect(0, 0, W, H); tg.globalCompositeOperation = 'source-over';
  L.drawImage(tc, cx, cy); L.globalAlpha = 1;
  L.lineWidth = 1;
  for (const o of SC.occ) {
    L.strokeStyle = '#ff40ff'; L.beginPath(); o.poly.forEach(([x, y], i) => i ? L.lineTo(x * k, y * k) : L.moveTo(x * k, y * k)); L.closePath(); L.stroke();
    L.strokeStyle = '#ffffff'; L.setLineDash([3, 2]); L.beginPath(); L.moveTo(o.x, o.base); L.lineTo(o.x + o.w, o.base); L.stroke(); L.setLineDash([]);
  }
  L.strokeStyle = '#ff40ff'; for (const poly of def.secret_walk || []) { L.beginPath(); poly.forEach(([x, y], i) => i ? L.lineTo(x * k, y * k) : L.moveTo(x * k, y * k)); L.closePath(); L.stroke(); }   // Job 8d: secret pads
  for (const j of def.jumps || []) { L.strokeStyle = j.auto ? '#ff8040' : '#ffd040'; L.strokeRect(j.r[0] * k, j.r[1] * k, (j.r[2] - j.r[0]) * k, (j.r[3] - j.r[1]) * k); L.fillStyle = L.strokeStyle; L.fillRect(j.to[0] * k - 2, j.to[1] * k - 2, 4, 4); }
  L.strokeStyle = '#4090ff'; for (const w of SC.water || []) { L.beginPath(); w.poly.forEach(([x, y], i) => i ? L.lineTo(x * k, y * k) : L.moveTo(x * k, y * k)); L.closePath(); L.stroke(); }
  const box = (r, col) => { L.strokeStyle = col; L.strokeRect(r[0] * k, r[1] * k, (r[2] - r[0]) * k, (r[3] - r[1]) * k); };
  def.doors.forEach(d => box(d.r, '#40e0ff')); def.exits.forEach(d => box(d.r, '#ffe040')); (def.warps || []).forEach(d => { box(d.r, '#c080ff'); if (d.at && d.at.length >= 2 && (!d.to || d.to === SC.id)) { L.fillStyle = '#c080ff'; L.fillRect(d.at[0] * k - 2, d.at[1] * k - 2, 4, 4); } }); def.things.forEach(d => box(d.r, '#ff9040'));
  L.fillStyle = '#fff'; L.fillRect(SC.hero.x - 1, SC.hero.y - 1, 2, 2);
}
function drawSceneUI() {
  const jj = !Dialog.active && !Script.active && !SC.hero.moving && !SC.hop && scJumpFind(), t = !Dialog.active && !Script.active && !SC.hero.moving && !SC.hop && (sceneTarget() || (jj && (G.f['jump_' + jj.id] || jj.tell || SC.padOn >= 0) ? { jump: jj } : null));
  if (t) {
    const h = SC.hero, x = h.x - SC.cam.x, y = h.y - SC.cam.y - 48 + Math.sin(frame / 8) * 1.5;
    uiBubble(x, y - 2, t.npc || t.follower ? '…' : '?');
  }
  if (window.SCENE_TEST && !Dialog.active) {
    X.fillStyle = 'rgba(10,8,16,.55)'; X.fillRect(0, (H - 16) * S, W * S, 16 * S);
    txt(`${keyName('move')} move · ${keyName('b')} run · ${keyName('a')} examine · T day / dusk · G show hidden layers · V silhouette · ` + (castList().length > 10 ? '1-9, 0, [ ]' : castList().length > 9 ? '1-9, 0' : '1-' + castList().length) + ' switch character', W / 2, H - 14, '#e8dcc0', 9, 'center', false);
    drawCastCard();
  }
}
// scene tests: a small card shows who you are playing and the number keys that switch (the cast content kind, 01d_cast.js)
function drawCastCard() {
  const CAST = castList(), ch = CAST[CAST_I], x = 5, y = 5, pw = 30, ph = Math.max(pw + 8, 18 + CAST.length * 7.5);
  X.fillStyle = 'rgba(10,8,16,.7)'; rr(x * S, y * S, 92 * S, ph * S, 5); X.fill();
  X.strokeStyle = '#d6b068'; X.lineWidth = 1.5; rr(x * S, y * S, 92 * S, ph * S, 5); X.stroke();
  X.imageSmoothingEnabled = false; X.drawImage(portrait(HERO_SPR), (x + 4) * S, (y + 4) * S, pw * S, pw * S);
  txt(ch.name, x + 38, y + 5, '#f4e0b0', 10, 'left', false);
  CAST.forEach((c, i) => txt((i < 9 ? i + 1 : i === 9 ? 0 : '+') + ' ' + c.name, x + 38, y + 15 + i * 7.5, i === CAST_I ? '#ffe9a8' : '#8f8a9a', 7, 'left', false));
}
window.addEventListener('keydown', e => {
  if (G.state !== 'scene') return;
  if (window.SCENE_TEST && !Dialog.active) { const m = /^(?:Digit|Numpad)([0-9])$/.exec(e.code), n = m ? (m[1] === '0' ? 10 : +m[1]) : 0; const nc = castList().length; if (n && n <= nc) { CAST_I = n - 1; return; } if (e.code === 'BracketLeft' || e.code === 'BracketRight') { CAST_I = (CAST_I + (e.code === 'BracketRight' ? 1 : nc - 1)) % nc; return; } }
  if (e.code === 'KeyT' && window.SCENE_TEST) gameHook('sceneTestDay');   // test pages only: the game flips its day / dusk (in the game it follows the story)
  if (e.code === 'KeyG' && window.SCENE_TEST) { SC.layers = !SC.layers; }
  if (e.code === 'KeyV') { SC.ghost = SC.ghost === false; }   // hero silhouette behind foreground pieces on / off
});

// Job fw-F3a: the kit's own layers. Job 9c: animated water over the painting, under the actors and the cut-outs; Job 8d: a faint
// sparkle on a jump's launch spot until it has been used once
defineLayer('backdrop', 'water', { owner: 'kit:topdown', order: 200, fn: (cx, cy, ix) => drawWaterLoops(cx, cy, ix) });
defineLayer('backdrop', 'water-rings', { owner: 'kit:topdown', order: 210, fn: () => drawWaterRings() });   // rings round his feet in moving water
defineLayer('actors', 'jumpHints', { owner: 'kit:topdown', order: 300, fn: acts => {
  for (const j of scJumps()) if (j.hint && !G.f['jump_' + j.id] && (j.pad == null ? -1 : j.pad) === SC.padOn && !SC.hop) {
    const x = j.hint[0] * SC.k, y = j.hint[1] * SC.k;
    acts.push({ y, f: () => { const t = frame / 18 + x, a = 0.25 + Math.sin(t) * 0.2, r = 1.5 + Math.sin(t) * 0.8;
      L.globalCompositeOperation = 'lighter'; L.globalAlpha = a; L.drawImage(glowSprite(6, '#cfe8ff'), x - 6, y - 8);
      L.fillStyle = '#f4faff'; L.fillRect(x - r, y - 2, r * 2, 1); L.fillRect(x - 0.5, y - 1.5 - r, 1, r * 2); L.globalAlpha = 1; L.globalCompositeOperation = 'source-over'; } });
  }
} });

// Job fw-F2: the painted scene is the top-down kit's main mode (the road's walking legs and the cinema layer draw over it)
defineMode('scene', { kit: 'topdown', update: () => sceneUpdate(), art: () => drawScene(),
  grade: () => { if (typeof cineGrade === 'function') cineGrade(); },
  ui: () => { drawSceneUI(); drawRoadWalkUI(); drawWarpOverlay(); drawBanner(); if (typeof drawCine === 'function') drawCine(); } });
