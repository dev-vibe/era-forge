// ============================================================
//  Battle signature effects (Job 11z, 22 Oct 2026; Ash, 21 Oct: 'animations or particle something to enhance the
//  individual battle techniques moments. same for enemies' special attacks'). One moment for every technique and every enemy
//  special, in the ink-on-washi language of 07b: brush strokes, ink spatter, paper, a few warm sparks.
//  The rules call techFx(id, when, ...) and foeFx(kind, when, ...) (07_battle.js); each effect is a B.fx entry { type, ... } drawn by the
//  theme's drawer for its type (job fw-F4: themeFx(type), src/01a_game.js section 8; the ink drawers, once FX_DRAW here, are in
//  themes/ink-washi/battle_fx.js). This file keeps the recipes: which effects a moment starts, where, how long and in what colours.
//  f.layer: 'ground' = under the fighters, 'screen' = over the whole frame (outside the camera zoom), none = over the fighters.
//  Fast battle speed halves every lifetime (bfxLife); the impact frame (ink and paper only) skips them.
// ============================================================
const bfxLife = n => Math.max(4, Math.round(cfg().speed > 1 ? n / 2 : n));
function bfx(type, o) { const f = Object.assign({ type, t: 0 }, o); f.duration = o.life || 30; f.life = bfxLife(f.duration); B.fx.push(f); return f; }
const bEase = u => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
const bFade = (k, from) => k < from ? 1 : Math.max(0, 1 - (k - from) / (1 - from));   // 1 until `from`, then down to 0 at the end
// Motion is cosmetic: feet used by battlePlace, damage, turn order and timing never move.
function fxMove(w, kind, life = 24) { w.flair = { kind, t: 0, life: bfxLife(life) }; }
function fxMotion(w) {
  const f = w.flair, m = { x: 0, y: 0, rot: 0, sx: 1, sy: 1 }; if (!f) return m;
  const k = clamp(f.t / f.life, 0, 1), pulse = Math.sin(Math.PI * k), dir = w.m ? -1 : 1;
  if (f.kind === 'recoil') { m.x = -dir * 12 * pulse * (1 - k); m.rot = -dir * 0.1 * pulse; }
  if (f.kind === 'dodge') { m.x = -dir * 26 * pulse; m.y = -5 * pulse; m.rot = -dir * 0.16 * pulse; }
  if (f.kind === 'dance') { m.y = -9 * pulse; m.rot = Math.sin(k * Math.PI * 2) * 0.16; m.sx = 1 - pulse * 0.12; }
  if (f.kind === 'plant') { m.y = 3 * pulse; m.sx = 1 + pulse * 0.09; m.sy = 1 - pulse * 0.08; }
  if (f.kind === 'cut') { m.x = dir * 9 * pulse; m.rot = dir * 0.09 * pulse; }
  return m;
}
const fxX = w => w.x + (w.off || 0) + fxMotion(w).x;
const fxFootY = w => w.y - (w.offY || 0) + fxMotion(w).y + (w.d && (w.d.kind === 'crow' || w.d.kind === 'bat') ? Math.sin(B.at / 8 + w.x) * 4 - 26 : 0);
// Measure the opaque ready figure, not its transparent pose-sheet cell. New pose sheets inherit these anchors.
const FX_BOUNDS = new WeakMap();
function fxHeight(w) {
  if (w.fxHeight) return w.fxHeight;
  const ec = w.d && enemyCast(w.id), id = w.m ? memberCastId(w.m) : ec && ec[0];
  const ps = id && poseSprite(id, 'ready', !!w.d), pair = w.m ? memberBattleSprite(w) : enemyBattleSprite(w);
  const s = ps || pair[0], sc = ps ? BS * (ec ? ec[1] : 1) / ps.q : pair[1];
  let h = FX_BOUNDS.get(s);
  if (h == null) {
    h = s.height * (ps ? 0.74 : 1);
    try {
      const data = s.getContext('2d').getImageData(0, 0, s.width, s.height).data; let top = s.height, bottom = 0;
      for (let y = 0; y < s.height; y++) for (let x = 0; x < s.width; x++) if (data[(y * s.width + x) * 4 + 3] > 40) { top = Math.min(top, y); bottom = y; }
      h = Math.max(12, bottom - top);
    } catch (_) { /* A cross-origin artifact image can be drawn but cannot be sampled. Keep the sheet-scale anchor. */ }
    FX_BOUNDS.set(s, h);
  }
  return (w.fxHeight = h * sc);
}
const fxBodyY = (w, height = 0.55) => fxFootY(w) - fxHeight(w) * height;

// Advance histories on the game clock. Taking screenshots or rendering twice never changes an effect.
function tickBattleFlair() {
  for (const w of [...B.party, ...B.enemies]) if (w.flair && ++w.flair.t >= w.flair.life) w.flair = null;
  for (const f of B.fx) if (f.type === 'trail' && f.t <= f.rec) {
    const p = [fxX(f.who), fxBodyY(f.who)], last = f.pts[f.pts.length - 1];
    if (!last || Math.hypot(last[0] - p[0], last[1] - p[1]) > 1) f.pts.push(p);
  }
}
function drawSignatureFx(g, f) {
  // Fast plays the whole gesture in half the time: particles travel the same distance and delayed rings still appear.
  const duration = f.duration || f.life;
  g.save(); themeFx(f.type)(g, Object.assign({}, f, { t: f.t * duration / f.life, life: duration }), f.t / f.life); g.restore();
}
function fxArc(w, col, r = 52, o = {}) { return bfx('ribbon', Object.assign({ who: w, col, r, flat: 0.45, rise: 20, w: 8, life: 34, seed: ri(1, 999) }, o)); }
function fxSparks(x, y, col, n = 12, life = 28) {
  bfx('sparks', { x, y, col, ps: Array.from({ length: n }, (_, i) => ({ a: i / n * 6.283 + rnd(-0.2, 0.2), v: rnd(1.8, 4.8), len: rnd(6, 15) })), life });
}
function missFx(w) {
  if (w.m) fxGhost(w, 0.6, 28);
  fxMove(w, 'dodge', 26);
  bfx('crescent', { x0: fxX(w) + 34, y0: fxBodyY(w) - 30, x1: fxX(w) + 48, y1: fxBodyY(w) + 32, w: 5, bend: 0.15, col: '#eee0c0', seed: ri(1, 999), life: 20 });
  bfx('puffs', { layer: 'ground', ps: fxPuffs(w.x, w.y, 6, { spread: 10, r: 5, vx: 2, col: '#ddd0b0' }), a: 0.5, life: 24 });
}

function fxGhost(p, a, life) {
  const [s, sc, , isPose, ax] = memberBattleSprite(p); if (!s) return;
  bfx('ghost', { layer: 'ground', s, w: s.width * sc, h: s.height * sc, ax: isPose && ax != null ? ax : 0.5, x: fxX(p), y: p.y, a, life });
}
function fxLeaves(n) {
  const C = ['#c8642a', '#e0a040', '#9a3a1c', '#b8862a'];
  return Array.from({ length: n }, (_, i) => ({ x: W + rnd(0, 160), y: rnd(60, 300), vx: -rnd(10, 16), ph: rnd(0, 6.28), spin: rnd(-0.3, 0.3), sz: rnd(3.6, 5.6), d: ri(0, 10), grass: i % 3 === 0, c: i % 3 === 0 ? '#9aaa4a' : pick(C) }));
}
// jagged lines out from (x, y); flat squashes them onto the ground
function fxCracks(x, y, n, len, flat) {
  return Array.from({ length: n }, (_, i) => {
    const a = i / n * 6.283 + rnd(-0.3, 0.3), pts = [[x, y]], segs = ri(3, 5); let cx = x, cy = y;
    for (let s = 0; s < segs; s++) { const aa = a + rnd(-0.5, 0.5), l = len / segs * rnd(0.7, 1.3); cx += Math.cos(aa) * l; cy += Math.sin(aa) * l * flat; pts.push([cx, cy]); }
    return pts;
  });
}
function fxChips(x, y, n, o) {
  return Array.from({ length: n }, () => {
    const a = o.dir != null ? o.dir + rnd(-0.7, 0.7) : rnd(0, 6.283), v = rnd(o.v[0], o.v[1]), z = rnd(o.sz[0], o.sz[1]);
    return { x: x + rnd(-4, 4), y: y + rnd(-4, 4), vx: Math.cos(a) * v, vy: Math.sin(a) * v - (o.up || 0), gr: o.gr == null ? 0.16 : o.gr, r0: rnd(0, 6.28), spin: rnd(-0.4, 0.4),
      pts: [[-z, -z * 0.4], [z * 0.8, -z * 0.6], [z * 0.3, z * 0.7]], c: pick(o.cols), edge: o.edge };
  });
}
function fxPuffs(x, y, n, o = {}) {
  return Array.from({ length: n }, () => ({ x: x + rnd(-(o.spread || 10), o.spread || 10), y: y + rnd(-2, 2), vx: rnd(-1, 1) * (o.vx || 0.8), vy: -rnd(0.1, o.rise || 0.4), r: rnd(3, o.r || 6), c: o.col }));
}
// the 'ground' and 'screen' layers (drawBattle); the rest are drawn with the other effects over the fighters
function drawFxLayer(layer, impact) {
  if (impact) return;
  for (const f of B.fx) if (f.layer === layer && !THEME_FX_RAW.has(f.type)) drawSignatureFx(L, f);
}
// one effect over the fighters (drawBattle): a raw drawer every frame, the impact frame included; a signature effect except on the impact frame
function drawBattleFx(g, f, impact) {
  if (THEME_FX_RAW.has(f.type)) themeFx(f.type)(g, f, impact);
  else if (!impact) drawSignatureFx(g, f);
}

// ---------------- the party's techniques ----------------
// when: 'go' (sets off), 'land' (the blade lands; list = the foes it hits), 'back' (home again), 'self' (a stance or a cry),
// 'heal' (a song lands; list = those healed), 'call' and 'up' (a revive song)
function techFx(id, when, p, list = [], g) {
  if (gameHook('techFx', id, when, p, list, g) === true) return;   // the game drew it (a game's own recipes)
  const px = fxX(p), foes = list.filter(Boolean);
  switch (id + ':' + when) {
    // the standoff's first cut: one stroke across the whole screen
    case 'firstcut:land':
      if (foes[0]) fxSparks(foes[0].x, hitY(foes[0]), '#fff0ce', 22, 34);
      bfx('wash', { layer: 'screen', col: '#fffbe8', a: 0.45, flash: true, life: 10 });
      bfx('crescent', { layer: 'screen', x0: W + 20, y0: 50, x1: -20, y1: H - 50, w: 30, bend: 0.12, red: true, draw: 4, seed: ri(1, 999), life: 40 });
      break;
    // a game with no GAME_HOOKS.techFx (it returns true for the pairs it draws): a plain cut
    default:
      if (GAME_HOOKS.techFx) break;   // a game with its own recipes draws nothing for the pairs it leaves out
      if (when === 'go') { fxGhost(p, 0.45, 26); fxArc(p, '#f2e6c8', 48, { flat: 0.6, rise: 22, w: 6, life: 24 }); }
      else if (when === 'land') for (const e of foes) fxSparks(e.x, hitY(e), '#f2e6c8', 10);
  }
}
// ---------------- enemy specials ----------------
// kind: the skill's fx ('heavy', 'lunge', 'leap', 'fire', 'cleave', 'roar'), or 'swoop' for a crow's or a bat's attack;
// when: 'go' (sets off; 'throw' for the fire pot), 'hit' (lands on tgt)
function foeFx(kind, when, e, tgt, guarded) {
  if (!kind || !tgt) return;
  const tx = fxX(tgt), ty = fxFootY(tgt), hy = fxBodyY(tgt);
  if (when === 'windup' && ['heavy', 'lunge', 'cleave', 'fire'].includes(kind)) {
    fxArc(e, '#cf5b3a', kind === 'cleave' ? 74 : 44, { rise: fxHeight(e) * 0.55, flat: 0.65, sweep: -3.8, w: 6, life: 24 });
    return;
  }
  if (when === 'miss') {
    // The weapon passes beside the dodging fighter; no hit sparks or damage reaction.
    missFx(tgt);
    if (kind === 'fire') { bfx('puffs', { ps: fxPuffs(tx + 44, ty, 12, { col: '#5c4b3b', r: 12, rise: 0.8, vx: 1.8 }), life: 40 }); bfx('scorch', { layer: 'ground', x: tx + 44, y: ty, life: 100 }); }
    return;
  }
  switch (kind + ':' + when) {
    case 'heavy:hit':
      bfx('crescent', { x0: tx + 20, y0: hy - 38, x1: tx - 16, y1: ty - 6, w: 13, bend: 0.1, red: true, draw: 3, seed: ri(1, 999), life: 30 });
      bfx('puffs', { ps: fxPuffs(tx, ty - 2, 7, { spread: 16, col: '#b8a07a', r: 6, vx: 1.4 }), a: 0.5, life: 30 });
      break;
    case 'lunge:hit':
      bfx('speed', { x0: e.x + 16, x1: tx + 18, y: hy, ls: Array.from({ length: 9 }, () => ({ s: rnd(0, 0.4), len: rnd(0.3, 0.6), dy: rnd(-14, 14), w: rnd(0.6, 1.5), a: rnd(0.4, 0.8) })), col: '#ffe0c8', glow: '#ff9070', life: 22 });
      sfx('spear'); break;
    case 'leap:go': bfx('trail', { who: e, pts: [], rec: bfxLife(12), w: 5, life: 30 }); break;
    case 'leap:hit':
      for (let i = 0; i < 3; i++) bfx('crescent', { x0: tx + 8 + i * 6, y0: hy - 25 + i * 3, x1: tx - 14 + i * 6, y1: hy + 22 + i * 3, w: 6, bend: 0.12, red: true, draw: 3, wait: i * 2, seed: ri(1, 999), life: 30 });
      break;
    case 'swoop:go': bfx('trail', { who: e, pts: [], rec: bfxLife(12), w: 3.2, life: 26 }); break;
    case 'swoop:hit':
      fxArc(null, e.d.kind === 'crow' ? '#d2c6bb' : '#b7a4ca', 36, { x: tx, y: ty, rise: ty - hy, flat: 0.75, w: 5, sweep: -4.5, life: 24 });
      if (e.d.kind === 'crow') bfx('chips', { ps: fxChips(tx, hy, 8, { v: [0.4, 1.5], sz: [1.6, 3.2], up: 0.4, gr: 0.03, cols: ['#1a1418', '#2a2430'] }), life: 40 }); break;
    case 'fire:throw': {
      const sx = fxX(e) + 18, sy = fxBodyY(e, 0.65);
      e.potFx = bfx('pot', { x0: sx, y0: sy, x1: tx, y1: hy, apex: 64, life: 18 });
      sfx('arrow', 0.5); break;
    }
    case 'fire:hit':
      fxSparks(tx, hy, '#ffb65b', 22, 34);
      bfx('ring', { layer: 'ground', x: tx, y: ty, r0: 10, r1: 84, flat: 0.35, col: '#e7a457', w: 5, ink: true, life: 28 });
      bfx('fire', { x: tx, y: hy, life: 26 });
      bfx('embers', { ps: Array.from({ length: 34 }, () => ({ x: tx + rnd(-12, 12), y: ty - rnd(14, 36), vx: rnd(-1.6, 1.6), vy: -rnd(0.6, 2.4), ph: rnd(0, 6.28), z: rnd(1.8, 3.2), c: pick(['#ffb040', '#ff7030', '#ffe090']) })), life: 50 });
      bfx('puffs', { ps: fxPuffs(tx, ty - 30, 9, { spread: 16, col: '#3a3430', r: 10, rise: 0.9, vx: 0.6 }), a: 0.55, life: 60 });
      bfx('scorch', { layer: 'ground', x: tx, y: ty, life: 180 });
      break;
    case 'cleave:hit': {
      const x0 = tx + 130, y0 = hy - 126, x1 = tx - 150, y1 = hy + 110;
      bfx('split', { layer: 'screen', x: tx, y: hy, ang: Math.atan2(y1 - y0, x1 - x0), hold: 8, life: 10 });
      bfx('crescent', { layer: 'screen', x0, y0, x1, y1, w: 26, bend: 0.22, red: true, draw: 4, seed: ri(1, 999), life: 40 });
      B.zoom = { k: 1.07, x: tx, y: ty - 40, t: 0, dur: 24 };
      break;
    }
    case 'roar:go': {
      const ex = fxX(e), ey = fxBodyY(e, 0.78);
      bfx('wash', { layer: 'screen', col: '#0a060c', a: 0.4, life: 46 });
      bfx('ring', { x: ex, y: ey, r0: 10, r1: 220, n: 3, gap: 8, col: UI.paper, w: 3, ink: true, a: 0.7, life: 40 });
      bfx('word', { layer: 'screen', text: 'Kneel!', x: W / 2, y: 112, size: 34, life: 46 });
      B.shake = Math.max(B.shake, 14);
      sfx('taiko'); break;
    }
  }
  if (when === 'hit' && kind !== 'roar') fxSparks(tx, hy, guarded ? '#a8dbf2' : '#ffce92', guarded ? 8 : 12, 24);
}
