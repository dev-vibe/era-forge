// ============================================================
//  Turn-based battle, v2 (Job 11, 20 Oct 2026; design in the battle v2 doc in claude/)
//  A round: every standing member chooses and acts (the hero first), then every enemy acts. New in v2:
//   - timed hits: an ink ring closes on the target; pressing as it closes makes a Good or a Perfect cut (more damage, more
//     posture damage, Ki). a hold-and-release technique is held and let go; a song is pressed on the beat.
//   - intents: each enemy shows its next action and target at the start of the round (Heavy blows wind up visibly).
//   - posture (kuzushi): cuts crack an enemy's posture; at zero it is Broken: its action is cancelled, it takes x1.5 damage
//     and recovers when the next enemy phase comes round.
//   - Guard command (half damage this round, +2 Ki); Ki earned by good cuts.
//   - boss standoff before a boss fight; difficulty (07c_settings.js); Try again after a loss.
//  Drawing, poses and ink effects are in 07b_battle_draw.js.
//  Kept from v1: the party of three, a decoy drawing every attack, a revive song, getting up with 1 HP after a won
//  fight, painted backdrops with everyone placed on real walkable ground (battleStage, job battle-place: the camera zoomed to the
//  scene's scale, the line where the two sides met, the walk onto the marks).
// ============================================================
const B = {};
const BSPR = {};
const BS = 0.75;  // cast sheets in battle: one sheet px = 1.5 screen px (about the size the rooms show them at heroK 1.5)
// an enemy's sheet: its `enemies` entry's `cast` (a cast id) drawn at `castScale` x the party's size; null for one with no sheet
const enemyCast = id => { const d = contentGet('enemies', id); return d && d.cast ? [d.cast, d.castScale || 1] : null; };
function scaledCached(k, fn, sc) { k += 'x' + sc; return BSPR[k] || (BSPR[k] = sc === 1 ? fn() : scaleUp(fn(), sc)); }
// where the party stands (feet), by party size
const PARTY_POS = [[[492, 238]], [[476, 226], [548, 250]], [[486, 232], [550, 208], [558, 256]]];
// Enemy HP grows by this share of its base for every fighter beside the hero (balance pass, Job 9 polish, 11 Oct 2026;
// was 0.35 / 0.7). Tuned with bal/sim.py so a fight with the party takes about as long as the same fight did alone.
const FOE_SCALE = { foe: 0.6, boss: 0.8 };   // boss 0.8 with the tougher base bosses of 14 Oct 2026 (bal/boss_sweep.py)
const POST_SCALE = 0.3;   // posture grows by this share per companion
const COMMANDS = ['Strike', 'Technique', 'Guard', 'Item', 'Flee'];
const battleCommands = () => B.opts.duel ? ['Strike', 'Technique', 'Guard', 'Item', 'Concede'] : COMMANDS;

function startBattle(ids, opts = {}) {
  // a fight started in a painted scene without its own backdrop uses the screen it started on (Job 8e); on a scene with a walk mask
  // it gets its own camera window and marks (battleStage below, job battle-place)
  const wasScene = G.state === 'scene', onScene = sceneFight(opts);
  if (onScene) opts = Object.assign({}, opts, { paintImg: SC.img });
  else if (G.state === 'scene' && SC.img && !opts.paint && !opts.paintImg && !opts.bg) { const iw = SC.img.width / SC.ww, c = SC.cam; opts = Object.assign({}, opts, { paintImg: SC.img, crop: [Math.max(0, c.x) * iw, Math.max(0, c.y) * iw, Math.min(W, SC.ww) * iw, Math.min(H, SC.wh) * iw] }); }
  const df = diff();
  // the party
  const mem = opts.solo ? [G.hero] : typeof battleParty === 'function' ? battleParty() : [G.hero], pp = PARTY_POS[mem.length - 1];
  B.party = mem.map((m, i) => ({ m, name: typeof memberName === 'function' ? memberName(m) : GAME.hero.name, x: pp[i][0], y: pp[i][1], off: 0, offY: 0, fr: 0, flash: 0, guard: 0, debuff: 0, cover: 0, pose: null, hurt: 0 }));
  const np = B.party.length;
  // the enemies: tougher when more swords face them (bosses more so)
  const counts = {}, seen = {}; ids.forEach(i => counts[i] = (counts[i] || 0) + 1);
  const n = ids.length;
  const hasBoss = ids.some(i => contentGet('enemies', i).scale);
  let pos = n === 1 ? [[210, 238]] : n === 2 ? [[170, 222], [270, 250]] : [[130, 212], [260, 228], [185, 254]];
  if (hasBoss) pos = n === 1 ? [[210, 250]] : [[210, 250], [310, 220], [100, 226]];
  B.enemies = ids.map((id, i) => {
    const d = contentGet('enemies', id); seen[id] = (seen[id] || 0) + 1;
    const hp = Math.round(d.hp * (1 + (d.boss ? FOE_SCALE.boss : FOE_SCALE.foe) * (np - 1)) * df.hp);
    const pm = Math.max(2, Math.round((d.post || 5) * (1 + POST_SCALE * (np - 1)) * df.post));
    return { id, d, name: d.name + (counts[id] > 1 ? ' ' + 'ABC'[seen[id] - 1] : ''), hp, maxHp: hp, post: pm, postMax: pm, broken: false, skip: false, plans: [], x: pos[i][0], y: pos[i][1], alive: true, flash: 0, fade: 1, off: 0, offY: 0, pose: null, hurt: 0 };
  });
  if (hasBoss) { const bi = B.enemies.findIndex(e => e.d.scale); if (bi > 0) { const b = B.enemies.splice(bi, 1)[0]; B.enemies.unshift(b); B.enemies.forEach((e, i) => { e.x = pos[i][0]; e.y = pos[i][1]; }); } }
  const boss = !!(opts.boss && !opts.noLose && !opts.noStandoff);
  Object.assign(B, { opts, bg: opts.bg || 'field', phase: boss ? 'standoff' : 'intro', t: 0, at: 0, tick: 0, sel: 0, sub: 0, target: 0, q: [], msg: '', pops: [], fx: [], shake: 0, lines: [], li: 0, pending: null, turn: 0, ally: 0, allyList: [],
    tm: null, stop: 0, impact: 0, zoom: null, cut: null, wipe: 0, so: null, ink: boss ? 1 : 0, bgc: null, bgInk: null, loseSel: 0, round: 0, sigSeen: {}, tags: [] });
  if (boss) { const hard = cfg().diff === 'hard'; B.so = { t: 0, glint: ri(110, 190), held: false, res: null, feint: hard ? ri(50, 95) : -1, flick: 0 }; B.so.feint = B.so.feint >= B.so.glint - 12 ? -1 : B.so.feint; }
  B.stage = null; B.tr = null;
  if (onScene) battleStage(B.opts);   // the camera window and everyone's marks on the scene (job battle-place)
  // the walk onto the marks (07b drawBattle): the field view eases into the fight's window while everyone goes from where they stood
  // on the map to their mark; it opens on a short impact frame instead of the encounter flash and the wipe (a boss has its standoff)
  if (B.stage && wasScene && !boss && !B.retrying && opts.transition !== false) {
    B.tr = { t: 0, len: cfg().speed > 1 ? 24 : 34, c0: B.stage.view0, c1: B.stage.win };
    B.wipe = 40; B.impact = 3; G.flash = 0;
  }
  if (opts.duel) duelPlace(opts.duel);
  const names = [...new Set(ids.map(i => contentGet('enemies', i).name))];
  B.msg = hasBoss || opts.boss ? `${B.enemies[0].d.name} stands in your way!` : (n > 1 ? `${names.join(' and ')} attack!` : `A ${names[0]} appears!`);
  if (boss) B.msg = '';
  if (!B.retrying) G.battleReturn = G.state === 'battle' ? 'field' : G.state;
  G.state = 'battle';
  // what the fight began with, for Try again
  if (!B.retrying) B.snap = { ids: ids.slice(), opts, party: mem.map(m => [m, m.hp, m.ki]), inv: JSON.parse(JSON.stringify(G.inv || {})) };
  B.retrying = false;
  if (typeof opts.onStart === 'function') opts.onStart(B);   // job fw-F5a (gap G16): the game's own opening state of the fight (a foe already broken, less posture); Try again runs it again
  playMusic(opts.boss ? 'boss' : 'battle');
  if (boss) sfx('taiko');
}
// ---------------- the fight on its own painted scene: the camera and everyone's marks (job battle-place, 1 Nov 2026) ----------------
// Ash, 31 Oct 2026: "often the placement of characters/enemies in the screen are odd". Before, a fight on the scene it started on
// kept the field camera (so outdoors the fighters stood half again as tall as the fences they stood by), started from a fixed
// formation and took the first shift of it that put every pair of feet on walkable ground, up to 300 px away from where the two
// sides had met. Now a fight on its own scene:
//  1. zooms the camera so the painting matches the battle sprites: they are drawn at GAME.battle.heroK (default 1.5) times a cast
//     sheet's unit size, the scene draws its hero at the scene's heroK (1 outdoors), so the view comes battle/scene times closer
//     (1.5x outdoors, 1x in a room drawn at 1.5 or more; never further out than the field camera);
//  2. stands the battle line where the sides met (the hero and the field foe, the hero and the NPC the enemy is, opts.at, or the
//     scene's authored `battleSpots`), choosing the camera window and the formation together by a score: every fighter's feet on
//     walkable ground in the hero's own area and clear of the foreground layer, plenty of open ground round the feet (in front most),
//     close to the meeting point, squeezed only when it has to be; a tight spot pans the camera to the nearest open ground;
//  3. remembers where everyone stood on the map (B.stage.from) for the walk onto the marks (B.tr, the transition, 07b).
// A fight on its own painting (opts.paint / opts.bg that is not the scene's, a duel's road card) keeps the fixed formation.
const battleHeroK = () => (GAME.battle && GAME.battle.heroK) || 1.5;
const isFlier = b => !b.m && !!b.d && (b.d.kind === 'crow' || b.d.kind === 'bat');
// is this fight on the painted scene the hero is in? (opts.view === false: no)
function sceneFight(o) {
  if (typeof SC !== 'object' || !SC.img || !SC.def || !SC.mask || o.view === false || o.duel) return false;
  if (o.paintImg) return o.paintImg === SC.img;
  if (o.paint) return o.paint === SC.def.img && !o.crop;
  return G.state === 'scene' && !o.bg;
}
// the walk grid round the meeting point: G px cells over the world rect [x0, y0, x0 + gw * G, y0 + gh * G]
const STAGE_G = 3;
function stageGrid(x0, y0, x1, y1) {
  const g = STAGE_G; x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(SC.ww, x1); y1 = Math.min(SC.wh, y1);
  const gw = Math.max(1, Math.ceil((x1 - x0) / g)), gh = Math.max(1, Math.ceil((y1 - y0) / g)), n = gw * gh;
  const walk = new Uint8Array(n);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) if (scWalk(x0 + i * g + g / 2, y0 + j * g + g / 2)) walk[j * gw + i] = 1;
  // the connected area the hero stands in (if he is in the grid), else every walkable cell. Flooded on the walk mask itself, one world px
  // at a time (a coarse grid cuts the thin necks between a yard's props and leaves him in a pocket)
  let ok = walk; const h = SC.hero;
  if (h) {
    const X0 = x0, Y0 = y0, RW = Math.min(SC.ww, x0 + gw * g) - X0, RH = Math.min(SC.wh, y0 + gh * g) - Y0, wk = (x, y) => scWalk(X0 + x, Y0 + y);
    let seed = -1; const hx = Math.round(h.x - X0), hy = Math.round(h.y - Y0);
    for (let r = 0; r < 30 && seed < 0; r++) for (let dy = -r; dy <= r && seed < 0; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = hx + dx, y = hy + dy; if (x >= 0 && y >= 0 && x < RW && y < RH && wk(x, y)) { seed = y * RW + x; break; }
    }
    if (seed >= 0) {
      const area = new Uint8Array(RW * RH), st = [seed]; area[seed] = 1;
      while (st.length) { const c = st.pop(), x = c % RW, y = (c - x) / RW;
        if (x > 0 && !area[c - 1] && wk(x - 1, y)) { area[c - 1] = 1; st.push(c - 1); }
        if (x < RW - 1 && !area[c + 1] && wk(x + 1, y)) { area[c + 1] = 1; st.push(c + 1); }
        if (y > 0 && !area[c - RW] && wk(x, y - 1)) { area[c - RW] = 1; st.push(c - RW); }
        if (y < RH - 1 && !area[c + RW] && wk(x, y + 1)) { area[c + RW] = 1; st.push(c + RW); } }
      ok = new Uint8Array(n);
      for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { const x = Math.round(i * g + g / 2), y = Math.round(j * g + g / 2);
        if (walk[j * gw + i] && x < RW && y < RH && area[y * RW + x]) ok[j * gw + i] = 1; }
    }
  }
  // ground under the foreground layer (a maple canopy, a roof the hero walks behind) is no place to stand in a fight: battle sprites
  // are drawn over the painting, so a fighter there would seem to stand on top of the tree
  const fgs = [...new Set((SC.def.occ || []).map(o => o.src).filter(Boolean))].map(nm => assetImg(nm)).filter(Boolean);
  if (fgs.length) {
    const [, cg] = mk(gw, gh), iw = SC.img.width / SC.ww;
    for (const im of fgs) { const r = (im.width || SC.img.width) / SC.img.width; cg.drawImage(im, x0 * iw * r, y0 * iw * r, gw * g * iw * r, gh * g * iw * r, 0, 0, gw, gh); }
    try { const d = cg.getImageData(0, 0, gw, gh).data; if (ok === walk) ok = walk.slice(); for (let c = 0; c < n; c++) if (d[c * 4 + 3] > 40) ok[c] = 0; } catch (e) {}
  }
  // open ground: how far (world px, up to 60) every cell is from ground nobody could stand on (a 3-4 chamfer distance)
  const BIG = 1 << 14, dt = new Uint16Array(n);
  for (let c = 0; c < n; c++) dt[c] = ok[c] ? BIG : 0;
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { const c = j * gw + i; if (!dt[c]) continue; let v = dt[c];
    if (i > 0) v = Math.min(v, dt[c - 1] + 3); else v = Math.min(v, 3);
    if (j > 0) { v = Math.min(v, dt[c - gw] + 3); if (i > 0) v = Math.min(v, dt[c - gw - 1] + 4); if (i < gw - 1) v = Math.min(v, dt[c - gw + 1] + 4); } else v = Math.min(v, 3);
    dt[c] = v; }
  for (let j = gh - 1; j >= 0; j--) for (let i = gw - 1; i >= 0; i--) { const c = j * gw + i; if (!dt[c]) continue; let v = dt[c];
    if (i < gw - 1) v = Math.min(v, dt[c + 1] + 3); else v = Math.min(v, 3);
    if (j < gh - 1) { v = Math.min(v, dt[c + gw] + 3); if (i < gw - 1) v = Math.min(v, dt[c + gw + 1] + 4); if (i > 0) v = Math.min(v, dt[c + gw - 1] + 4); } else v = Math.min(v, 3);
    dt[c] = v; }
  const at = (x, y) => { const i = Math.floor((x - x0) / g), j = Math.floor((y - y0) / g); return i >= 0 && j >= 0 && i < gw && j < gh ? j * gw + i : -1; };
  return { ok: (x, y) => { const c = at(x, y); return c >= 0 && ok[c] === 1; }, clear: (x, y) => { const c = at(x, y); return c < 0 ? 0 : Math.min(60, dt[c] / 3 * g); } };
}
// the camera window and every fighter's mark. Sets B.stage { z, win: [x, y, w, h] world rect, E, grid, from }, opts.crop (image px)
// and every fighter's x, y (battle screen px).
function battleStage(o) {
  const z = Math.max(1, battleHeroK() / scHK());
  const vw = Math.min(W / z, SC.ww), vh = Math.min(H / z, SC.wh), zx = W / vw, zy = H / vh;
  const h = SC.hero, f = o.sceneFoe || null;
  // the enemy the hero faced: the field foe, else an NPC with an enemy's id (a boss he has been talking to), else opts.foeNpc
  const npc = f ? null : (o.foeNpc && scNpc(o.foeNpc)) || B.enemies.map(e => scNpc(e.id)).find(Boolean) || null;
  const foe = f || npc;
  let E = foe ? [(h.x + foe.x) / 2, (h.y + foe.y) / 2] : [h.x, h.y];
  // an authored spot: the one the content names (opts.spot, a battleSpots id), else opts.at (scene px), else the scene's battleSpots entry
  // whose r holds E, else the nearest within its `near`
  const K = SC.k || 1;
  let spot = (o.spot && (SC.def.battleSpots || []).find(s => s.id === o.spot)) || (o.at ? { at: o.at } : null);
  if (!spot && o.spot !== false) { let best = 1e9; for (const s of SC.def.battleSpots || []) {
    if (!scTrigOn(s)) continue;
    const inR = s.r && scIn(s.r, E[0], E[1]), d = Math.hypot(s.at[0] * K - E[0], s.at[1] * K - E[1]);
    if ((inR || d <= (s.near || 200) * K) && (inR ? -1 : d) < best) { best = inR ? -1 : d; spot = s; } } }
  const all = [...B.party, ...B.enemies], grounded = all.filter(b => !isFlier(b));
  // the default formation (battle px): its centre P0 is where the line sits on screen when the window is free to move
  const P0 = [grounded.reduce((t, b) => t + b.x, 0) / grounded.length, grounded.reduce((t, b) => t + b.y, 0) / grounded.length];
  const off = all.map(b => [b.x - P0[0], b.y - P0[1]]);
  const winAt = C => [vw >= SC.ww ? (SC.ww - vw) / 2 : clamp(C[0] - P0[0] / zx, 0, SC.ww - vw), vh >= SC.wh ? (SC.wh - vh) / 2 : clamp(C[1] - P0[1] / zy, 0, SC.wh - vh)];
  // the anchor the rules stand the line round: where the sides met, except along an axis where the window cannot move (a room that is one
  // screen): there the meeting point would only slide the whole line across a fixed picture, so the line keeps the formation's own place
  // on screen (Ash, 1 Nov 2026, a boss fight in a one-screen hall: "the chars are weirdly far to the right", the boss "almost in the center")
  const A = E.slice();
  if (vw >= SC.ww) A[0] = (SC.ww - vw) / 2 + P0[0] / zx;
  if (vh >= SC.wh) A[1] = (SC.wh - vh) / 2 + P0[1] / zy;
  const RAD = 260;
  const grid = stageGrid(A[0] - RAD - 360 / zx, A[1] - RAD * 0.75 - 200 / zy, A[0] + RAD + 360 / zx, A[1] + RAD * 0.75 + 140 / zy);
  const half = b => (b.m ? 12 : (b.d.scale ? 22 : 14)) / zx, fy = 1 / zy;
  const feet = (x, y, hw) => grid.ok(x, y) && grid.ok(x - hw, y) && grid.ok(x + hw, y) && grid.ok(x, y - 6 * fy) && grid.ok(x, y + 6 * fy) && grid.ok(x - hw * 0.7, y + 4 * fy) && grid.ok(x + hw * 0.7, y + 4 * fy);
  // one candidate: the line's centre C (world) and squeeze s; null if someone has nowhere to stand, else its score and marks
  const tryAt = (C, s) => {
    const w0 = winAt(C), pts = [];
    let minC = 1e9, sum = 0;
    for (let i = 0; i < all.length; i++) {
      const b = all[i], x = C[0] + off[i][0] * s / zx, y = C[1] + off[i][1] * s / zy, sx = (x - w0[0]) * zx, sy = (y - w0[1]) * zy;
      if (sx < 14 || sx > W - 14) return null;
      if (isFlier(b)) { if (sy < 96 || sy > 262) return null; pts.push([sx, sy]); continue; }
      if (sy < 108 || sy > 266 || !feet(x, y, half(b))) return null;
      const cl = grid.clear(x, y) + 0.5 * grid.clear(x, y + 8 * fy); minC = Math.min(minC, cl); sum += Math.min(cl, 40);
      pts.push([sx, sy]);
    }
    const n = grounded.length || 1, cs = [(C[0] - w0[0]) * zx, (C[1] - w0[1]) * zy];
    // (a move past 80 px costs more and more: a fight leaves the yard or the path it started on only when there is truly no room)
    const dE = Math.hypot(C[0] - anc[0], (C[1] - anc[1]) * 1.3), far = Math.max(0, dE - 80);
    const score = 4 * Math.min(minC, 10) + 0.25 * sum / n - 0.12 * dE - 0.002 * far * far - 30 * (1 - s) - 0.04 * Math.hypot(cs[0] - P0[0], cs[1] - P0[1]);
    return { score, pts, win: w0, C };
  };
  let anc = A;   // what a candidate is scored against: the search's own centre
  const search = (E0, rad, squeezes) => {
    let best = null; anc = E0;
    for (const s of squeezes) for (let dy = -rad * 0.75; dy <= rad * 0.75; dy += 6) for (let dx = -rad; dx <= rad; dx += 6) {
      if ((dx * dx) / (rad * rad) + (dy * dy) / (rad * rad * 0.5625) > 1) continue;
      const r = tryAt([E0[0] + dx, E0[1] + dy], s); if (r && (!best || r.score > best.score)) best = r;
    }
    return best;
  };
  let pick = null, mode = 'rules';
  if (spot && (spot.party || spot.foes)) {   // hand-placed (the battle spot editor writes these, 07e)
    mode = 'placed';   // an authored formation: everyone's own mark (scene px), the window round them
    const wp = [...B.party.map((b, i) => spot.party && spot.party[i]), ...B.enemies.map((b, i) => spot.foes && spot.foes[i])];
    // the window: the spot's own `view` (its top-left, scene px, as the editor saves it), else round `at` as the formation would sit
    const C = spot.at ? [spot.at[0] * K, spot.at[1] * K] : E, w0 = winAt(C);
    if (spot.view) { if (vw < SC.ww) w0[0] = clamp(spot.view[0] * K, 0, SC.ww - vw); if (vh < SC.wh) w0[1] = clamp(spot.view[1] * K, 0, SC.wh - vh); }
    pick = { win: w0, C, pts: all.map((b, i) => wp[i] ? [(wp[i][0] * K - w0[0]) * zx, (wp[i][1] * K - w0[1]) * zy] : [(C[0] + off[i][0] / zx - w0[0]) * zx, (C[1] + off[i][1] / zy - w0[1]) * zy]) };
  }
  if (!pick && spot) {   // an authored place without marks: the rules, searched close round it, squeezed down to its own `squeeze` (a crowded yard)
    mode = 'spot';
    const lo = spot.squeeze || 0.55, sq = [1, 0.85, 0.7, 0.55, 0.45, 0.35].filter(v => v >= lo - 1e-6);
    pick = search([spot.at[0] * K, spot.at[1] * K], (spot.rad || 40) * K, sq);
  }
  if (!pick) { mode = 'rules'; pick = search(A, RAD, [1, 0.85, 0.7, 0.55]); }
  if (!pick) pick = search(A, RAD * 1.6, [0.55, 0.45]);
  if (!pick) { mode = 'fallback'; const w0 = winAt(A); pick = { win: w0, C: A, pts: all.map(b => [b.x, b.y]), fallback: true }; }   // nowhere: the default formation
  all.forEach((b, i) => { b.x = Math.round(pick.pts[i][0]); b.y = Math.round(pick.pts[i][1]); });
  const win = [pick.win[0], pick.win[1], vw, vh], iw = SC.img.width / SC.ww;
  o.crop = win.map(v => v * iw);
  // where everyone stood on the map (world px), for the transition: the hero where he was, the foe he met where it was, the rest
  // coming in from the edges of the field view (companions from behind him, other foes from their side, fliers from above)
  const c = SC.cam, cw = Math.min(W, SC.ww), ch = Math.min(H, SC.wh), toW = b => [win[0] + b.x / zx, win[1] + b.y / zy];
  let lead = foe ? B.enemies.find(e => e.id === (f ? f.kind : npc.id)) || B.enemies[0] : null;
  const from = new Map();
  B.party.forEach((p, i) => from.set(p, i === 0 ? [h.x, h.y] : [Math.max(c.x, 0) + cw + 18 + i * 16, toW(p)[1]]));
  B.enemies.forEach((e, i) => { const t = toW(e); from.set(e, e === lead ? [foe.x, foe.y] : isFlier(e) ? [t[0], Math.max(c.y, 0) - 30 - i * 12] : [Math.max(c.x, 0) - 18 - i * 16, t[1]]); });
  B.stage = { z, zx, zy, win, E, A, P0, C: pick.C, grid, from, lead, mode, fallback: !!pick.fallback, view0: [c.x, c.y, cw, ch], spot: spot ? (spot.id || true) : null };
}
// how this fight was placed (tests, the Battle Lab, the battle spot editor): { mode, spot } with mode 'placed' (a battleSpots entry's own
// marks), 'spot' (the rules round an authored spot), 'rules' (the rules round where the sides met), 'fallback' (no room anywhere: the
// default formation) or 'fixed' (a fight on its own painting: the kit's fixed formation)
function battlePlacement() { const s = B.stage; return s ? { mode: s.mode, spot: s.spot } : { mode: 'fixed', spot: null }; }
// a battle-screen point's ground test (tests, the Battle Lab): walkable, in the hero's area, clear of the foreground layer
function battleGroundMap() {
  const s = B.stage; if (!s) return null;
  return (x, y) => s.grid.ok(s.win[0] + x / s.zx, s.win[1] + y / s.zy);
}
const alive = () => B.enemies.filter(e => e.alive);
const up = p => p.m.hp > 0;
const standing = () => B.party.filter(up);
const actor = () => B.party[B.turn];
const solo = () => B.party.length === 1;
// the action queue: { d: ticks, start(), upd(t) -> true ends the step early }
function q(d, start, upd) { B.q.push({ d, start, upd, t: 0 }); }
function pop(x, y, text, col, big, huge) { B.pops.push({ x, y, text, col, t: 0, big: !!big, huge: !!huge }); }
const gainKi = (p, n) => { if (!n) return; const s = memberStats(p.m); p.m.ki = Math.min(s.maxKi, p.m.ki + n); };

// ---------------- timing ----------------
// B.tm = { kind: 'press' | 'release' | 'beat', at: tick of contact, from: tick the ring starts, x, y (where the ring closes),
//          res: null | 'perfect' | 'good' | 'early' | 'late' | 'none', holding }
// Job 16a: the ring itself is shared with every minigame (tmNew / gradeOf / tmInput / tmPoll / tmGrade in 05a_minigame.js); the battle keeps these names
function startTiming(kind, x, y, lead) { B.tm = Object.assign(tmNew(kind, B.tick, lead), { x, y }); return B.tm; }
function timingInput() { tmInput(B.tm, B.tick); }
// the step that waits for the press (or the end of the window); then grade() says what it was
function awaitTiming() { q(600, null, () => tmPoll(B.tm, B.tick)); }
function grade() { return tmGrade(B.tm); }
const GRADE = { perfect: { dmg: 1.5, post: 2, ki: 2, stop: 8 }, good: { dmg: 1.2, post: 1.5, ki: 1, stop: 5 }, none: { dmg: 1, post: 1, ki: 0, stop: 3 } };
function gradePop(g, x, y) {
  const r = B.tm && B.tm.res;
  if (g === 'perfect') pop(x, y, 'Clean cut!', '#f6d890', true);
  else if (g === 'good') pop(x, y, 'Good', '#f0e0b0', true);
  else if (r === 'early') pop(x, y, 'Too soon', '#a89c84');
  // the first timed hits of the game teach themselves (G.f.tmN counts them)
  if (G.f) G.f.tmN = (G.f.tmN || 0) + 1;
}

function memberDamage(p, e, mult, pierce) {
  const s = memberStats(p.m);
  let atk = s.atk * (p.debuff > 0 ? 0.75 : 1) * mult;
  let dmg = (atk - (pierce ? 0 : e.d.def * 0.5)) * rnd(0.88, 1.12);
  const crit = Math.random() < 0.08;
  if (crit) dmg *= 1.75;
  if (e.broken) dmg *= 1.5;
  else if (e.duelFeint) dmg *= 0.6;
  else if (e.duelOpen) dmg *= 1.3;
  return { dmg: Math.max(1, Math.round(dmg)), crit };
}
// where on an enemy a blade lands (logical px)
const hitY = e => fxBodyY(e);
// one cut landing on one enemy, with the grade already known
function landCut(p, e, o, g, first) {
  if (!e || !e.alive) return;
  const G0 = GRADE[g];
  if (o.missed && o.missed.has(e)) { sfx('miss'); pop(e.x, hitY(e) - 28, 'Miss', '#c8c0b0'); missFx(e); return; }
  const { dmg, crit } = memberDamage(p, e, o.mult * G0.dmg, o.pierce);
  const hy = hitY(e);
  inkSlash(e.x, hy, g, o.all);
  sfx(crit || g === 'perfect' ? 'crit' : 'slash');
  B.stop = Math.max(B.stop, G0.stop + (crit ? 3 : 0)); B.shake = Math.max(B.shake, g === 'perfect' || crit ? 7 : 4);
  if (g === 'perfect' || crit) { B.impact = 2; B.zoom = { k: 1.07, x: e.x, y: hy, t: 0, dur: 26 }; }
  if (crit) pop(e.x, e.y - (e.d.scale ? 132 : 88), 'Critical!', '#f0c860');
  e.hp -= dmg; e.flash = 10; e.hurt = 16; pop(e.x, e.y - (e.d.scale ? 96 : 62), String(dmg), e.broken ? '#ffd080' : '#fff', true, crit || g === 'perfect');
  if (enemyCast(e.id)) setClip(e, enemyCast(e.id)[0], 'hit', e.hp <= 0 ? 'heavy' : 'light', e.hp <= 0 ? 20 : 16, e.hp <= 0);   // Job 17 drawn reaction
  fxMove(e, 'recoil', crit || g === 'perfect' ? 30 : 20);
  if (first) gainKi(p, G0.ki);
  if (e.hp <= 0) { e.hp = 0; e.alive = false; e.pose = 'down'; setTimeout(() => sfx('hit'), 120); return; }
  // posture
  if (!e.broken) {
    e.post -= Math.round((o.post || 2) * G0.post);
    if (e.post <= 0) breakEnemy(e);
  }
}
function breakEnemy(e) {
  e.duelFeint = e.duelOpen = false;
  e.post = 0; e.broken = true; e.skip = true; e.plans = [];
  B.stop = Math.max(B.stop, 12); B.impact = 3; B.zoom = { k: 1.09, x: e.x, y: hitY(e), t: 0, dur: 32 };
  sfx('guard'); setTimeout(() => sfx('taiko'), 60);
  B.fx.push({ type: 'burst', x: e.x, y: hitY(e), t: 0 });
  // cracked-ink shards (Job 11z)
  bfx('crack', { lines: fxCracks(e.x, hitY(e), 7, e.d.scale ? 46 : 32, 1), grow: 3, red: true, a: 0.9, life: 26 });
  bfx('chips', { ps: fxChips(e.x, hitY(e), 12, { v: [1.6, 4], sz: [2.4, 5], up: 1, cols: ['#16101a', '#2a1c20'], edge: 'rgba(201,67,47,.95)' }), life: 36 });
  pop(e.x, e.y - (e.d.scale ? 150 : 104), 'Broken!', '#ff9070', true);
  if (!B.taughtBreak && G.f && !G.f.breakSeen) { G.f.breakSeen = 1; B.coach = { t: 0, text: 'Broken! Its next move is lost, and it takes more damage until it recovers.' }; }
}

// the acting member dashes in, cuts one (or every) enemy, and dashes back
// o = { mult, label, all, pierce, post, timing: 'press' | 'release', preGrade (skip the press: the standoff), cutin,
//       sig (a technique id for its signature effect, techFx in 07d) }
function strikeStep(p, target, o) {
  if (typeof o !== 'object') o = { mult: o };   // (old call shape)
  o = Object.assign({ mult: 1, post: 2, timing: 'press' }, o);
  let tg = null, dx = -144, g = 'none';
  const pickTg = () => { tg = o.all ? alive()[0] : (target && target.alive ? target : alive()[0]); };
  // the drawn clip (Job 17), when this fighter has one: the held release's own strip, else the Strike strip
  // (a technique's own strip when it has one, else the fighter's Strike / attack strip; none: the pose cells)
  const cast = p.m ? memberCastId(p.m) : null, clip = o.timing === 'release' && !o.preGrade ? releaseClip() : cast && strikeClip(cast, o.sig);
  const sc = (ph, len) => cast && clip && setClip(p, cast, clip, ph, len);
  q(1, () => { B.msg = o.label || ''; pickTg(); });
  if (o.cutin) techIntro(p, o.cutin);
  if (o.timing === 'release' && !o.preGrade) {
    // Release: hold, steel glints, release
    q(1, () => { pickTg(); p.pose = 'ready'; B.msg = `Hold ${keyName('a')} ... release the instant steel flashes.`; startTiming('release', p.x - 18, p.y - 30, ri(40, 64)); sc('enter', 18); });
    awaitTiming();
    q(1, () => { g = grade(); B.lastGrade = B.tm ? B.tm.res : g; gradePop(g, p.x - 10, p.y - 92); B.msg = o.label || ''; if (tg) dx = Math.min(-60, tg.x + (tg.d.scale ? 74 : 48) - p.x); if (o.sig) techFx(o.sig, 'go', p, [tg], g); });
    q(5, () => sc('draw', 5), t => { p.off = dx * bEase(t / 5); p.pose = 'cut'; });
  } else {
    q(1, () => { pickTg(); if (!tg) return; dx = o.all ? Math.min(-60, (alive().reduce((a, e) => a + e.x, 0) / alive().length) + 60 - p.x) : Math.min(-60, tg.x + (tg.d.scale ? 74 : 48) - p.x);
      if (!o.preGrade) startTiming('press', tg.x, hitY(tg), 18); p.pose = 'ready'; sc('dash', 8); if (o.sig) techFx(o.sig, 'go', p, [tg]); });
    q(12, null, t => {
      const u = t / 12;
      p.off = t < 3 ? Math.sin(t / 3 * Math.PI) * 5 : dx * bEase((t - 3) / 9);
      p.offY = o.sig === 'crush' ? Math.sin(u * Math.PI) * 21 : o.sig === 'sweep' ? Math.sin(u * Math.PI) * 6 : 0;
      p.fr = t % 8 < 4 ? 1 : 3; if (t > 7) p.pose = 'wind';
      if (t === 8) sc('wind', 4);
    });
    if (!o.preGrade) awaitTiming();
    q(1, () => { g = o.preGrade || grade(); B.lastGrade = B.tm ? B.tm.res : g; if (tg) gradePop(g, tg.x, tg.y - (tg.d.scale ? 176 : 120)); });
  }
  q(1, () => {
    p.pose = 'cut'; p.fr = 0; sc('cut', 11);
    const list = o.all ? alive() : [tg && tg.alive ? tg : alive()[0]];
    o.missed = new Set(list.filter(e => e && e.d.evade && g !== 'perfect' && Math.random() < e.d.evade));
    if (o.sig) techFx(o.sig, 'land', p, list.filter(e => !o.missed.has(e)), g);
    landCut(p, list[0], o, g, true);
    // a wide cut: the other foes are hit one after another, right after this step
    B.q.splice(1, 0, ...list.slice(1).map(e => ({ d: 5, t: 0, upd: t => { if (t === 5) landCut(p, e, o, g, false); } })));
  });
  q(10);
  q(12, () => { B.tm = null; sc('recover', 12); }, t => { p.off = dx * (1 - t / 12); p.fr = t % 8 < 4 ? 1 : 3; p.pose = 'ready'; });
  q(1, () => { p.fr = 0; p.off = 0; p.offY = 0; p.pose = null; p.clip = null; if (o.sig) techFx(o.sig, 'back', p); });
}
// after a member acts: the next standing member chooses, or the enemies act
function endTurn() {
  q(1, () => {
    if (!alive().length) { B.q = []; startVictory(); return; }
    for (let i = B.turn + 1; i < B.party.length; i++) if (up(B.party[i])) { B.turn = i; B.phase = 'cmd'; B.sel = 0; B.msg = ''; return; }
    enemyPhaseStep();
  });
}
// ---------------- intents ----------------
function makePlan(e, o = {}) {
  if (B.opts.duel) return duelPlan(e, o);
  let skill = null;
  if (e.d.skills) for (const sk of e.d.skills) { if (o.noHeavy && sk.heavy) continue; if (o.used && o.used.includes(sk)) continue; if (Math.random() < sk.chance) { skill = sk; break; } }
  const tag = skill ? (skill.tag || (skill.heavy ? 'Heavy' : skill.debuff ? 'Roar' : 'Skill')) : 'Cut';
  return { skill, tag, heavy: !!(skill && skill.heavy), tgt: o.tgt || pickTarget() };
}
function planEnemies() {
  for (const e of alive()) {
    if (e.broken) { e.plans = []; continue; }
    const acts = e.d.boss && B.party.length >= 3 ? 2 : 1;   // a boss facing three acts twice
    e.plans = []; for (let i = 0; i < acts; i++) e.plans.push(makePlan(e, { noHeavy: i > 0 && e.plans.some(p => p.heavy), used: e.plans.map(p => p.skill).filter(Boolean) }));   // a boss acting twice never repeats a skill in one round
  }
}
// who a plan will really hit: a decoy pulls every blow; a plan's target who is down is replaced
function planTarget(pl) {
  const st = standing(); if (!st.length) return null;
  const cov = st.find(p => p.cover > 0); if (cov) return cov;
  return pl && pl.tgt && up(pl.tgt) ? pl.tgt : st[Math.floor(Math.random() * st.length)];
}
function beginRound() {
  B.round++;
  B.turn = B.party.findIndex(up); B.phase = 'cmd'; B.sel = 0; B.msg = B.round === 1 && B.opts.coach ? B.opts.coach : '';   // Job 12j: a teaching bout's first prompt
  planEnemies();
}
function enemyPhaseStep() {
  q(1, () => {
    if (!alive().length) { B.q = []; startVictory(); return; }
    for (const e of alive()) {
      if (e.broken) {
        if (e.skip) { e.skip = false; q(1, () => { if (e.alive) { B.msg = `${e.name} is off balance!`; e.pose = 'hurt'; } }); q(34, null, () => { if (!e.alive) return true; }); continue; }
        // recovered: posture back, and it acts at once (never a Heavy without warning)
        e.broken = false; e.post = e.postMax; e.plans = [makePlan(e, { noHeavy: true })];
        q(1, () => { if (e.alive) pop(e.x, e.y - (e.d.scale ? 150 : 104), 'Recovers', '#c8c0b0'); });
      }
      for (const pl of e.plans) enemyAct(e, pl);
    }
    q(1, () => endRound());
  });
}
function pickTarget() {
  const st = standing(); if (!st.length) return null;
  const cov = st.find(p => p.cover > 0); if (cov) return cov;
  return st[Math.floor(Math.random() * st.length)];
}
function enemyAct(e, pl) {
  const skill = pl ? pl.skill : null; let tgt = null;
  const df = diff();
  // its signature effect (07d): the skill's fx, or a flier's swoop
  const kind = skill && skill.fx ? skill.fx : (e.d.kind === 'crow' || e.d.kind === 'bat') ? 'swoop' : null;
  // Job 17: its drawn clip (the roar has its own strip; every other action uses the foe's attack strip)
  const ecast = enemyCast(e.id) && enemyCast(e.id)[0], eclip = kind === 'roar' ? 'roar' : 'attack';
  const esc = (ph, len, keep = true) => ecast && setClip(e, ecast, eclip, ph, len, keep);
  q(1, () => { tgt = planTarget(pl); if (!e.alive || !tgt) return; e.pose = pl && pl.heavy ? 'wind' : 'ready'; if (eclip === 'attack') esc('windup', pl && pl.heavy ? 15 : 1); foeFx(kind, 'windup', e, tgt); B.msg = skill ? `${e.name} ${skill.msg}` : (solo() ? `${e.name} attacks!` : `${e.name} attacks ${tgt.name}!`); });
  if (pl && pl.heavy) q(14, null, () => { if (!e.alive) return true; });   // the wind-up held a moment longer
  if (kind === 'fire') q(18, () => { if (e.alive && tgt) { e.pose = 'cut'; esc('cut', 8); foeFx(kind, 'throw', e, tgt); } }, t => { if (!e.alive) return true; if (e.potFx) e.potFx.progress = t / 18; });   // flight follows the throw step, including Fast speed
  else if (kind === 'roar') q(30, () => { if (e.alive && tgt) { e.pose = 'wind'; esc('cut', 12); foeFx(kind, 'go', e, tgt); } }, () => { if (!e.alive) return true; });
  else {
    q(10, () => { if (e.alive && tgt) foeFx(kind, 'go', e, tgt); }, t => { if (e.alive && tgt) {
      const reach = ['leap', 'lunge', 'swoop', 'heavy', 'cleave'].includes(kind) ? Math.max(24, tgt.x - e.x - (kind === 'cleave' ? 92 : 46)) : 50;
      e.off = reach * bEase(t / 10); if (t > 6) e.pose = 'cut';
      if (t === 1) esc('lunge', 6); else if (t === 7) esc('cut', 6);
      if (kind === 'leap') e.offY = Math.sin(t / 10 * Math.PI) * 30; else if (kind === 'swoop') e.offY = -Math.sin(t / 10 * Math.PI) * 16;
    } });
  }
  q(1, () => {
    if (!e.alive || !tgt || !up(tgt)) return;
    const s = memberStats(tgt.m), px = tgt.x, py = tgt.y;
    if (skill && skill.debuff) { tgt.debuff = 3; sfx('deny'); pop(px, py - 70, 'Shaken', '#d8a0f0'); return; }
    const empty = tgt.emptyStep > 0;
    if (empty || Math.random() < 0.05 + Math.max(0, s.spd - e.d.spd) * 0.01) { tgt.emptyStep = 0; sfx('miss'); setClip(tgt, memberCastId(tgt.m), 'dodge', 'evade', 20, false); pop(px, py - 64, empty ? 'Empty Step' : 'Dodge', '#c8c0b0'); if (kind) foeFx(kind, 'miss', e, tgt); else missFx(tgt); return; }
    let dmg = skill && skill.dmg ? ri(skill.dmg[0], skill.dmg[1]) * df.atk : (e.d.atk * df.atk * (skill && skill.mult ? skill.mult : 1) - s.def * 0.5) * rnd(0.88, 1.12);
    const guarded = tgt.guard > 0 || tgt.cover > 0;
    if (guarded) dmg *= 0.5;
    dmg = Math.max(1, Math.round(dmg));
    tgt.m.hp = Math.max(B.opts.noLose ? 1 : 0, tgt.m.hp - dmg);   // noLose: a tutorial fight cannot be lost
    foeFx(kind, 'hit', e, tgt, guarded);
    fxMove(tgt, guarded ? 'plant' : 'recoil', guarded ? 16 : 24);
    sfx(skill && skill.sfx ? skill.sfx : guarded ? 'guard' : pl && pl.heavy ? 'blow' : 'hit');
    B.shake = pl && pl.heavy ? 10 : 7; tgt.flash = 10; tgt.hurt = guarded ? 0 : 16;
    // the drawn reaction (Job 17): knocked down when this blow ends it, else a light hit shaken off (a guard just plants)
    if (tgt.m.hp <= 0) setClip(tgt, memberCastId(tgt.m), 'hit', 'heavy', 20);
    else if (!guarded) setClip(tgt, memberCastId(tgt.m), 'hit', 'light', 16, false);
    B.stop = Math.max(B.stop, pl && pl.heavy ? 7 : 4);
    spatter(px, py - 30, guarded ? 4 : 8, 1);
    pop(px, py - 64, String(dmg), '#ff9070', true);
    if (guarded) pop(px, py - 84, 'Guarded', '#a0c8f0');
    if (tgt.m.hp <= 0) { tgt.guard = tgt.cover = tgt.debuff = 0; pop(px, py - 84, 'Down', '#e0b0a0'); sfx('down'); if (!solo() && standing().length) B.msg = `${tgt.name} is down!`; }
  });
  q(10, () => { e.off0 = e.off; e.offY = 0; if (e.alive) esc('recover', 10, false); }, t => { e.off = e.off0 * (1 - t / 10); });
  q(10, () => { e.off = 0; e.offY = 0; e.pose = null; if (!standing().length) { B.q = []; startDefeat(); } });
}
function endRound() {
  for (const p of B.party) { p.emptyStep = 0; if (p.guard > 0) p.guard--; if (!p.guard) p.stone = 0; if (p.debuff > 0) p.debuff--; if (p.cover > 0) p.cover--; }
  for (const e of alive()) if (!e.broken) e.post = Math.min(e.postMax, e.post + 1);
  if (!standing().length) return startDefeat();
  beginRound();
}
function startVictory() {
  if (B.opts.duel) { duelVictory(); return; }
  B.phase = 'win'; playMusic('victory'); B.tm = null;
  const xp = B.enemies.reduce((a, e) => a + e.d.xp, 0), mon = B.enemies.reduce((a, e) => a + e.d.mon, 0);
  const h = G.hero; h.xp += xp; h.mon += mon;
  if (mon) itemNotice('mon', 'i', mon);
  B.lines = ['Victory!', `Gained ${xp} experience${mon ? ` and ${mon} mon` : ''}.`];
  for (const e of B.enemies) if (e.d.drop && Math.random() < e.d.drop[1]) { give(e.d.drop[0]); B.lines.push(`Found ${contentGet('items', e.d.drop[0]).name}!`); }
  const got = typeof partyGetUp === 'function' ? partyGetUp() : [];
  if (got.length) B.lines.push(`${got.join(' and ')} ${got.length > 1 ? 'get' : 'gets'} back up.`);
  // catching breath (difficulty): Story heals everyone fully, Standard a quarter of max HP, Hard nothing
  const heal = diff().heal;
  if (heal > 0) {
    let any = false;
    for (const p of B.party) { const s = memberStats(p.m), was = p.m.hp; p.m.hp = Math.min(s.maxHp, Math.max(p.m.hp, 0) + Math.round(s.maxHp * heal)); if (p.m.hp > was) any = true; }
    if (any) B.lines.push(heal >= 1 ? (solo() ? `${GAME.hero.name} rests and is whole again.` : 'Everyone rests and is whole again.') : (solo() ? `${GAME.hero.name} catches ${heroHis()} breath.` : 'Everyone catches their breath.'));
  }
  while (h.xp >= xpToReach(h.lv + 1)) {
    const before = heroStats(h); h.lv++; const after = heroStats(h);
    if (typeof partyRestore === 'function') partyRestore(); else { h.hp = after.maxHp; h.ki = after.maxKi; }
    B.lines.push(`${solo() && Object.keys(G.allies || {}).length === 0 ? GAME.hero.name : 'The party'} reached level ${h.lv}!  ${GAME.hero.name}: HP +${after.maxHp - before.maxHp}  Atk +${after.atk - before.atk}  Def +${after.def - before.def}`);
    B.levelUp = true;
    const t = levelTechs()[h.lv]; if (t && !h.techs.includes(t)) { h.techs.push(t); B.lines.push(`${GAME.hero.name} learned ${contentGet('techniques', t).name}! ${contentGet('techniques', t).desc}`); }
  }
  B.li = 0; B.msg = B.lines[0];
  for (const p of B.party) if (up(p)) p.pose = null;
}
function startDefeat() { B.phase = 'lose'; B.t = 0; B.loseSel = 0; B.tm = null; B.msg = B.opts.duel ? `${GAME.hero.name} yields the point.` : solo() ? `${GAME.hero.name} falls...` : 'The party falls...'; playMusic(B.opts.duel && GAME.music.duelLose || 'gameover'); }
// Try again: the same fight, with HP, Ki and items as it began
function battleRetry() {
  const s = B.snap; if (!s) { G.state = 'gameover'; G.goT = 0; return; }
  for (const [m, hp, ki] of s.party) { m.hp = hp; m.ki = ki; }
  G.inv = JSON.parse(JSON.stringify(s.inv));
  B.retrying = true;
  startBattle(s.ids, s.opts);
}
function endBattle(result) {
  if (B.opts.duel) { duelFinish(result); return; }
  const fe = B.opts.fieldEnemy, m = G.map;
  const back = G.battleReturn === 'scene' && SC.def ? 'scene' : 'field';   // battles started from a painted scene return to it
  G.state = back; B.tm = null;
  if (result !== 'win') for (const p of B.party) if (p.m.hp <= 0) p.m.hp = 1;   // fled with someone down: they are carried out
  if (back === 'scene') playMusic(storyDef(SC.id) && storyDef(SC.id).music !== undefined ? storyMusic(SC.id) : null);
  else if (m) {
    if (fe && result === 'win') m.enemies = m.enemies.filter(e => e !== fe);
    if (fe && result === 'fled') fe.stun = 150;
    playMusic(m.music);
  }
  const sf = B.opts.sceneFoe; if (sf) { if (result === 'win') sf.gone = true; else sf.stun = 150; }   // painted-scene field foes (05d)
  G.safe = 50;
  if (result === 'win' && B.opts.onWin) B.opts.onWin();
  else if (result === 'win' && (fe || sf) && typeof techLessonAfterFight === 'function') techLessonAfterFight(B);   // Job 12j: technique lesson after a field fight
}

// choosing one member (heal, item, wake): list = the members that may be chosen
function chooseAlly(list, fn) {
  if (!list.length) { sfx('deny'); B.msg = 'No one to choose.'; return; }
  B.pendingBack = B.phase;
  if (list.length === 1 && solo()) { B.phase = 'busy'; fn(list[0]); return; }
  B.allyList = list; B.ally = Math.max(0, list.indexOf(actor())); B.allyFn = fn; B.phase = 'ally';
}
// quiet: the technique draws its own effect instead of the green rising lines
function healPop(p, amt, quiet) { if (amt <= 0) return; sfx('heal'); pop(p.x, p.y - 64, '+' + amt, '#90f0a0', true); if (!quiet) B.fx.push({ type: 'heal', x: p.x, y: p.y - 24, t: 0 }); }
// a song or dance on the beat: an ink ring closes on the first one healed; a press as it closes heals more
function beatSteps(p, first, label, cutin, apply) {
  q(1, () => { B.msg = label; });
  if (cutin) techIntro(p, cutin);
  let bid = null;
  q(1, () => { p.pose = 'wind'; const id = bid = Object.keys(content('techniques')).find(id => contentGet('techniques', id).name === cutin); if (id) techFx(id, 'go', p, [first]); startTiming('beat', first.x, first.y - 36, 26); if (id) setClip(p, memberCastId(p.m), id, 'beat', 26); });
  awaitTiming();
  q(1, () => { if (bid) setClip(p, memberCastId(p.m), bid, 'release', 20, false); const g = grade(), k = g === 'perfect' ? 1.5 : g === 'good' ? 1.25 : 1; if (g !== 'none') pop(first.x, first.y - 110, g === 'perfect' ? 'On the beat!' : 'Good', '#f6d890', g === 'perfect'); apply(k); B.tm = null; p.pose = null; });
  q(20);
}
// A technique announces itself with a small name slip over the fighter (it does not hold the action up). A fighter's
// signature art (TECHS[..].sig) gets a quiet ink band across the screen instead, the first time it is used in a fight.
function techIntro(p, name) {
  // every technique, every time: the full ink-band cut-in, and the action waits for it (Ash, 26 Oct 2026; it used to be the
  // signature arts' first use in a fight only, with a small name slip otherwise)
  q(cutinLen(), () => { B.cut = { t: 0, name, who: p }; sfx('ki'); });
}
function useTech(p, id) {
  const t = contentGet('techniques', id), m = p.m, label = `${p.name}: ${t.name}${t.target === 'one' || t.target === 'all' ? '!' : '.'}`;
  const spend = () => { m.ki -= t.ki; sfx('ki'); };
  const cutin = t.name;
  const cut = { mult: t.mult, label, pierce: t.pierce, post: t.post || 2, timing: t.timing === 'release' ? 'release' : 'press', cutin, sig: id };
  if (t.target === 'one') return chooseTarget(tg => { spend(); strikeStep(p, tg, cut); endTurn(); });
  if (t.target === 'all') { spend(); B.phase = 'busy'; strikeStep(p, null, Object.assign(cut, { all: true })); endTurn(); return; }
  const healOne = (tg, k) => { const s = memberStats(tg.m), amt = Math.min(s.maxHp - tg.m.hp, Math.round(s.maxHp * t.healPct * k)); tg.m.hp += amt; healPop(tg, amt, true); };
  if (t.target === 'ally') return chooseAlly(standing(), tg => { spend(); B.phase = 'busy'; beatSteps(p, tg, label, cutin, k => { healOne(tg, k); techFx(id, 'heal', p, [tg]); }); endTurn(); });
  if (t.target === 'allies') { spend(); B.phase = 'busy'; beatSteps(p, standing()[0], label, cutin, k => { const st = standing(); for (const tg of st) healOne(tg, k); techFx(id, 'heal', p, st); }); endTurn(); return; }
  if (t.target === 'fallen') {
    const down = B.party.filter(x => !up(x));
    if (!down.length) { sfx('deny'); B.msg = 'No one is down.'; return; }
    return chooseAlly(down, tg => { spend(); B.phase = 'busy'; q(1, () => { B.msg = label; }); techIntro(p, cutin);
      q(16, () => { techFx(id, 'call', p, [tg]); setClip(p, memberCastId(p.m), 'wake', 'call', 16); });   // the ring of the call reaches the fallen, then they rise
      q(24, () => { setClip(p, memberCastId(p.m), 'wake', 'settle', 24, false); const s = memberStats(tg.m); tg.m.hp = Math.max(1, Math.round(s.maxHp * t.revivePct)); healPop(tg, tg.m.hp, true); pop(tg.x, tg.y - 84, 'Up!', '#f6d890'); tg.pose = null; setClip(tg, memberCastId(tg.m), 'hit', 'rise', 12, false); techFx(id, 'up', p, [tg]); }); endTurn(); });
  }
  // self and cover
  spend(); B.phase = 'busy';
  q(1, () => { B.msg = label; });
  techIntro(p, cutin);
  q(24, () => {
    const s = memberStats(m);
    if (['stone', 'water', 'sute'].includes(id)) setClip(p, memberCastId(m), id, 'self', 24, false);   // Job 17 drawn technique
    techFx(id, 'self', p);
    if (t.healPct) { const amt = Math.min(s.maxHp - m.hp, Math.round(s.maxHp * t.healPct)); m.hp += amt; healPop(p, amt, true); }
    // the count drops after each enemy phase (endRound), so N covers exactly the N enemy turns the description promises
    // (it was N + 1 until the balance pass of 11 Oct 2026: a guard stance held 4 turns, a decoy 3)
    if (t.guard) { p.guard = t.guard; sfx('guard'); pop(p.x, p.y - 64, 'Guard', '#a0c8f0'); }
    if (t.cover) { p.cover = t.cover; sfx('guard'); pop(p.x, p.y - 64, 'Rearguard', '#a0c8f0'); }
    if (t.emptyStep) { p.emptyStep = 1; pop(p.x, p.y - 64, 'Empty Step', '#b9e3dd'); }
  });
  endTurn();
}
function useGuard(p) {
  B.phase = 'busy';
  q(1, () => { B.msg = `${p.name} braces.`; p.guard = Math.max(p.guard, 1); p.pose = 'guard'; gainKi(p, 2); sfx('guard'); pop(p.x, p.y - 64, 'Guard  +2 Ki', '#a0c8f0'); });
  q(26);
  endTurn();
}
function useItem(p, id) {
  const it = contentGet('items', id);
  if (it.escape) {
    if (B.opts.boss) { sfx('deny'); B.msg = 'Smoke will not help you here.'; return; }
    take(id); itemUsed(id, p.m, [p.sx ?? p.x, (p.sy ?? p.y) - 45]); B.phase = 'busy'; runOff(solo() ? `${GAME.hero.name} vanishes in a cloud of smoke!` : 'The party vanishes in a cloud of smoke!'); return;
  }
  chooseAlly(standing(), tg => {
    take(id); B.phase = 'busy';
    q(1, () => { B.msg = tg === p ? `${p.name} uses ${it.name}.` : `${p.name} gives ${it.name} to ${tg.name}.`; });
    q(24, () => {
      itemUsed(id, tg.m, [tg.sx ?? tg.x, (tg.sy ?? tg.y) - 45]);
      const s = memberStats(tg.m);
      if (it.hp) { const amt = Math.min(it.hp, s.maxHp - tg.m.hp); tg.m.hp += amt; healPop(tg, amt); }
      if (it.ki) { const amt = Math.min(it.ki, s.maxKi - tg.m.ki); tg.m.ki += amt; sfx('ki'); pop(tg.x, tg.y - 64, '+' + amt + ' Ki', '#90c8f0'); }
    });
    endTurn();
  });
}

// ---------------- the boss standoff ----------------
// Letterbox and ink wash; hold Z; when the boss's steel flashes, release. First cut / the boss strikes first / neither.
function standoffUpdate() {
  const so = B.so; so.t++;
  if (so.flick > 0) so.flick--;
  if (so.res) return;
  if (btn('a')) so.held = true;
  const w = timingWin(), W2 = { p: [w.p[0] * 2, w.p[1] * 2], g: [w.g[0] * 2, w.g[1] * 2] }, d = so.t - so.glint;
  if (d === 0) { sfx('ok'); B.fx.push({ type: 'glint', x: B.enemies[0].x + 18, y: B.enemies[0].y - (B.enemies[0].d.scale ? 120 : 74), t: 0 }); }
  if (so.feint > 0 && so.t === so.feint) { so.flick = 8; sfx('cursor'); }
  let res = null;
  if (so.held && !held('a')) res = gradeOf(d, W2);
  else if (d > W2.g[1] + 2) res = timingAuto() ? 'good' : so.held ? 'late' : 'none';
  if (res) { so.res = res; standoffResolve(res); }
}
function standoffResolve(res) {
  const p = B.party[0], boss = B.enemies[0];
  B.phase = 'busy';
  if (res === 'perfect' || res === 'good') {
    q(1, () => { B.msg = res === 'perfect' ? 'First cut! A perfect draw.' : 'First cut!'; sfx('crit'); });
    strikeStep(p, boss, { mult: 1.8, post: res === 'perfect' ? 6 : 4, preGrade: res, sig: 'firstcut', label: res === 'perfect' ? 'First cut! A perfect draw.' : 'First cut!' });
    q(1, () => { gainKi(p, 3); pop(p.x, p.y - 84, '+3 Ki', '#90c8f0'); });
  } else if (res === 'early') {
    q(1, () => { B.msg = `${GAME.hero.name} flinches! ${boss.d.name} strikes first!`; });
    q(30);
    enemyAct(boss, makePlan(boss, { noHeavy: true, tgt: p }));
  } else {
    q(1, () => { B.msg = 'Neither blade moves first.'; });
    q(50);
  }
  q(1, () => { if (!alive().length) { B.q = []; startVictory(); return; } if (!standing().length) return; beginRound(); });
}

function battleUpdate() {
  B.t++;
  if (B.tr && B.tr.t < B.tr.len && !B.impact) B.tr.t++;
  if (B.impact > 0) B.impact--;
  timingInput();
  if (B.stop > 0) { B.stop--; return; }   // hitstop: the world holds still for a few frames
  B.at++;
  tickBattleFlair();
  if (B.ink > 0 && B.phase !== 'standoff' && !(B.so && !B.so.res)) B.ink = Math.max(0, B.ink - 0.03);
  if (B.wipe < 40) B.wipe++;
  if (B.cut) { B.cut.t++; if (B.cut.t > cutinLen()) B.cut = null; }
  B.tags.forEach(t => t.t++); B.tags = B.tags.filter(t => t.t < 56);
  if (B.zoom) { B.zoom.t++; if (B.zoom.t > B.zoom.dur) B.zoom = null; }
  if (B.coach) { B.coach.t++; if (B.coach.t > 200) B.coach = null; }
  B.pops.forEach(p => p.t++); B.pops = B.pops.filter(p => p.t < (p.big ? 60 : 50));
  B.fx.forEach(f => { f.t++; if (f.vy != null) { f.x += f.vx; f.y += f.vy; f.vy += 0.25; } }); B.fx = B.fx.filter(f => f.t < (f.life || 26) || (f.type === 'pot' && f.progress < 1));
  B.enemies.forEach(e => { if (e.flash > 0) e.flash--; if (e.hurt > 0) e.hurt--; if (!e.alive && e.fade > 0 && !B.opts.duel) e.fade -= 0.04; });
  B.party.forEach(p => { if (p.flash > 0) p.flash--; if (p.hurt > 0) p.hurt--; });
  if (B.shake > 0) B.shake--;
  if (B.q.length) {
    // Fast battle speed: an extra tick every other frame, except while a timed press is open (timing keeps its pace)
    const n = cfg().speed > 1 && !B.tm && B.at % 2 === 0 ? 2 : 1;
    for (let i = 0; i < n && B.q.length && !B.stop; i++) {
      const s = B.q[0]; if (s.t === 0 && s.start) s.start(); s.t++; B.tick++;
      const done = s.upd ? s.upd(s.t) === true : false;
      if ((done || s.t >= s.d) && B.q[0] === s) B.q.shift();
    }
    return;
  }
  const p = actor(), m = p && p.m;
  switch (B.phase) {
    case 'standoff': standoffUpdate(); break;
    case 'intro': if (B.t > (B.tr ? B.tr.len + 18 : 45) || btn('a')) { if (B.tr) B.tr.t = B.tr.len; beginRound(); } break;
    case 'cmd': {
      const commands = battleCommands(), n = commands.length;
      if (nav('up')) { B.sel = (B.sel + n - 1) % n; sfx('cursor'); }
      if (nav('down')) { B.sel = (B.sel + 1) % n; sfx('cursor'); }
      if (btn('a')) {
        sfx('ok');
        const c = commands[B.sel];
        if (c === 'Strike') chooseTarget(t => { strikeStep(p, t, { mult: 1, post: 2, label: `${p.name} ${p.m === G.hero ? 'strikes' : allyDef(p.m.id).role === 'spear' ? 'thrusts' : 'strikes'}!` }); endTurn(); });
        else if (c === 'Technique') { B.phase = 'tech'; B.sub = 0; }
        else if (c === 'Guard') useGuard(p);
        else if (c === 'Item') { B.phase = 'item'; B.sub = 0; }
        else if (c === 'Flee') tryFlee();
        else if (c === 'Concede') endBattle('concede');
      }
      break;
    }
    case 'tech': {
      const list = m.techs;
      if (nav('up')) { B.sub = (B.sub + list.length - 1) % list.length; sfx('cursor'); }
      if (nav('down')) { B.sub = (B.sub + 1) % list.length; sfx('cursor'); }
      if (btn('b')) { B.phase = 'cmd'; sfx('back'); }
      if (btn('a')) {
        const id = list[B.sub], t = contentGet('techniques', id);
        if (m.ki < t.ki) { sfx('deny'); B.msg = 'Not enough Ki.'; break; }
        sfx('ok'); useTech(p, id);
      }
      break;
    }
    case 'item': {
      const list = invList().filter(i => !contentGet('items', i).key);
      if (!list.length) { B.msg = 'No usable items.'; if (btn('b') || btn('a')) { B.phase = 'cmd'; B.msg = ''; } break; }
      B.sub = Math.min(B.sub, list.length - 1);
      if (nav('up')) { B.sub = (B.sub + list.length - 1) % list.length; sfx('cursor'); }
      if (nav('down')) { B.sub = (B.sub + 1) % list.length; sfx('cursor'); }
      if (btn('b')) { B.phase = 'cmd'; sfx('back'); }
      if (btn('a')) { sfx('ok'); useItem(p, list[B.sub]); }
      break;
    }
    case 'target': {
      const al = alive();
      if (nav('up') || nav('left')) { B.target = (B.target + al.length - 1) % al.length; sfx('cursor'); }
      if (nav('down') || nav('right')) { B.target = (B.target + 1) % al.length; sfx('cursor'); }
      if (btn('b')) { B.phase = B.pendingBack || 'cmd'; sfx('back'); }
      if (btn('a')) { sfx('ok'); B.phase = 'busy'; B.pending(al[B.target]); }
      break;
    }
    case 'ally': {
      const al = B.allyList;
      if (nav('up') || nav('left')) { B.ally = (B.ally + al.length - 1) % al.length; sfx('cursor'); }
      if (nav('down') || nav('right')) { B.ally = (B.ally + 1) % al.length; sfx('cursor'); }
      if (btn('b')) { B.phase = B.pendingBack || 'cmd'; sfx('back'); }
      if (btn('a')) { sfx('ok'); B.phase = 'busy'; B.allyFn(al[B.ally]); }
      break;
    }
    case 'win': {
      if (btn('a')) { B.li++; sfx('cursor'); if (B.li >= B.lines.length) endBattle('win'); else { B.msg = B.lines[B.li]; if (/reached level/.test(B.lines[B.li])) sfx('levelup'); } }
      break;
    }
    case 'lose':
      if (B.t > 60) {
        if (nav('up') || nav('down')) { B.loseSel = 1 - B.loseSel; sfx('cursor'); }
        if (btn('a')) { sfx('ok'); if (B.loseSel === 0) battleRetry(); else if (B.opts.duel) endBattle('loss'); else { G.state = 'gameover'; G.goT = 0; } }
      }
      break;
  }
}
function chooseTarget(fn) {
  const al = alive();
  B.pendingBack = B.phase;
  if (al.length === 1) { B.phase = 'busy'; fn(al[0]); return; }
  B.pending = fn; B.target = 0; B.phase = 'target';
}
function tryFlee() {
  B.phase = 'busy';
  if (B.opts.noFlee) { q(1, () => { B.msg = B.opts.noFleeMsg || 'No retreat. The line holds!'; }); q(40, () => { B.phase = 'cmd'; B.msg = ''; }); return; }
  if (B.opts.boss) { q(1, () => { B.msg = 'There is no escape!'; }); q(40, () => { B.phase = 'cmd'; B.msg = ''; }); return; }
  const avg = alive().reduce((a, e) => a + e.d.spd, 0) / alive().length, st = standing();
  const spd = st.reduce((a, p) => a + memberStats(p.m).spd, 0) / st.length;
  const ch = clamp(0.55 + (spd - avg) * 0.05, 0.25, 0.9);
  // they turn their backs and run in place while it is decided (Ash, 21 Oct 2026)
  q(1, () => { B.msg = solo() ? `${GAME.hero.name} turns to run...` : 'The party turns to run...'; for (const x of standing()) x.flee = true; sfx('step'); });
  q(34, null, t => { for (const x of standing()) x.fr = Math.floor(t / 5) % 2 ? 1 : 3; if (t % 10 === 0) sfx('step'); });
  if (Math.random() < ch) runOff(solo() ? `${GAME.hero.name} slips away!` : 'The party slips away!');
  else { q(1, () => { B.msg = "Couldn't get away!"; sfx('deny'); for (const x of B.party) { x.flee = false; x.fr = 0; } }); q(24); enemyPhaseStep(); }   // a failed escape costs the whole round
}
// the party runs off to the right, out of the fight
function runOff(msg) {
  q(1, () => { B.msg = msg; sfx('flee'); for (const x of standing()) x.flee = true; });
  q(30, null, t => { for (const x of B.party) { x.off = t * 8; x.fr = Math.floor(t / 4) % 2 ? 1 : 3; } });
  q(1, () => endBattle('fled'));
}
