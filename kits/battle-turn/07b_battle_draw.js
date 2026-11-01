// ============================================================
//  Battle v2 drawing (Job 11, 20 Oct 2026): poses, ink effects, impact frames, the standoff, intents, posture,
//  the timing ring, cut-ins and the battle panels. Rules are in 07_battle.js.
// ============================================================

// ---------------- poses ----------------
// A pose sheet (app-made, sliced by make_pose.py): assets/game/pose_<cast>.png, 3 x 2 cells of POSE_CELL art px (x q for a
// hi-res sheet), every figure facing LEFT with its feet on the cell's bottom edge, centred. Cells:
// ready, wind (wind-up), cut (follow-through) / hurt, guard, down.
const POSE_CELL = [200, 120], POSE_AX = 0.6;   // the stance sits at 60% of the cell width (more room in front for the blade)
const POSE_I = { ready: 0, wind: 1, cut: 2, hurt: 3, guard: 4, down: 5 };
const POSE_CACHE = {};
function poseSprite(cast, pose, flip) {
  const sheet = assetImg('pose_' + cast); if (!sheet || POSE_I[pose] == null) return null;
  const key = cast + ':' + pose + (flip ? 'R' : ''); if (POSE_CACHE[key]) return POSE_CACHE[key];
  const q = Math.max(1, Math.round(sheet.width / (POSE_CELL[0] * 3))), w = POSE_CELL[0] * q, h = POSE_CELL[1] * q, i = POSE_I[pose];
  const [c, g] = mk(w, h); c.q = q; c.pose = 1;
  if (flip) { g.translate(w, 0); g.scale(-1, 1); }
  g.drawImage(sheet, (i % 3) * w, Math.floor(i / 3) * h, w, h, 0, 0, w, h);
  return (POSE_CACHE[key] = c);
}
const memberCastId = m => m === G.hero ? GAME.hero.cast : allyDef(m.id).cast;

// ---------------- animation clips (Job 17) ----------------
// A clip strip (app-made, sliced by make_anim.py): assets/game/anim_<cast>_<clip>.png, ONE row of n cells of CLIP_CELL art
// px (x q), every figure facing LEFT with its feet on the cell's bottom edge and the middle of its feet 80 art px from the
// cell's right edge: the same spot as in a pose cell, so a clip frame stands exactly where the pose it replaces stood.
// The engine owns the timing: each step of an action names a phase, and that phase's frames are spread over the step's
// own length in queue ticks (B.tick, so Fast speed and hitstop carry the drawing with them). A phase holds its last frame
// until the next phase or a clear (`keep`), or ends by itself. No clip art, or clips turned off: the pose cells, as before.
const CLIP_CELL = [240, 150], CLIP_AX = 1 - 80 / 240;
// the attack-strip phases every 8-drawing sword/spear/club action shares (Strike, techniques, companions' attacks)
const CLIP_ATK = { dash: [1, 2], wind: [3, 4], cut: [5, 6], recover: [7, 8] };
// a fighter's hit strip: light hit 1-4 back to READY; heavy 5-8 down to DOWN; rise = the knee drop backwards
const CLIP_HIT = { light: [1, 2, 3, 4], heavy: [5, 6, 7, 8], down: [8], rise: [7, 6, 1], shove: [2, 3], broken: [7] };
// big fighters fall back further: their strips use a wider cell with more room behind the feet
const BIG = { cell: [280, 170], right: 110 };
// the four animals draw in the pose-cell size (200 x 120) with the feet 80 art px from the right edge, as in their pose sheets
const CREATURE = { cell: [200, 120], right: 80 };
// the game's clips are the content kind `clips` { sheets: { cast: { clip: { n, ph, cell?, right? } } }, files: { cast: { clip: strip name } }, sig: { sig: clip } }:
// every fighter's strips (sheets), the strip file a clip is cut from when it is not named after the clip (files), and the clip a technique's `sig` plays
const clipTable = () => content('clips');
const releaseClip = () => clipTable().releaseClip || 'release';   // the clip name of a held-and-released strike
function strikeClip(cast, sig) { return [sig && (clipTable().sig || {})[sig], 'strike', 'attack'].find(c => c && clipDef(cast, c)) || null; }
const clipFile = (cast, clip) => { const f = (clipTable().files || {})[cast]; return 'anim_' + cast + '_' + ((f && f[clip]) || clip); };
const clipAx = (d, flip) => { const a = 1 - (d.right || 80) / (d.cell || CLIP_CELL)[0]; return flip ? 1 - a : a; };
// review switch: ?clips=0 in the URL, or the Battle Lab's "Animation clips" box
let CLIPS_ON = !/[?&]clips=0\b/.test((typeof location !== 'undefined' && location.search) || '');
function clipDef(cast, clip) {
  const t = (clipTable().sheets || {})[cast], d = t && t[clip];
  return d && CLIPS_ON && assetImg(clipFile(cast, clip)) ? d : null;
}
const CLIP_CACHE = {};
// frame f (1-based) of a clip, as its own canvas (c.q = the strip's density; c.clip marks it for put())
function clipFrame(cast, clip, f, flip) {
  const d = clipDef(cast, clip); if (!d) return null;
  const key = cast + ':' + clip + ':' + f + (flip ? 'R' : ''); if (CLIP_CACHE[key]) return CLIP_CACHE[key];
  const sheet = assetImg(clipFile(cast, clip)), w = Math.round(sheet.width / d.n), h = sheet.height, q = Math.max(1, Math.round(w / (d.cell || CLIP_CELL)[0]));
  const [c, g] = mk(w, h); c.q = q; c.clip = 1; c.ax = clipAx(d, flip);
  if (flip) { g.translate(w, 0); g.scale(-1, 1); }
  g.drawImage(sheet, (Math.max(1, Math.min(d.n, f)) - 1) * w, 0, w, h, 0, 0, w, h);
  return (CLIP_CACHE[key] = c);
}
// start a phase on a fighter: len = the engine step's length in queue ticks; keep = hold the last frame afterwards
function setClip(w, cast, clip, ph, len, keep = true) {
  const d = clipDef(cast, clip);
  if (!d || !d.ph[ph]) { w.clip = null; return false; }
  w.clip = { cast, c: clip, ph, t0: B.tick || 0, len: Math.max(1, len), keep };
  return true;
}
// the frame a fighter's clip shows now, or null (no clip, it ended, or its art is missing)
function clipSprite(w, flip) {
  const k = w.clip; if (!k) return null;
  const d = clipDef(k.cast, k.c); if (!d) return null;
  const fr = d.ph[k.ph], el = (B.tick || 0) - k.t0;
  if (el >= k.len && !k.keep) { w.clip = null; return null; }
  return clipFrame(k.cast, k.c, fr[Math.min(fr.length - 1, Math.floor(el / k.len * fr.length))], flip);
}
// the pose a fighter shows right now
function partyPose(p) {
  if (!up(p)) return 'down';
  if (p.pose) return p.pose;
  if (p.hurt > 0) return 'hurt';
  if (p.guard > 0 || p.cover > 0) return 'guard';
  return 'ready';
}
const choosingPhase = () => ['cmd', 'tech', 'item', 'target', 'ally'].includes(B.phase);
function enemyPose(e) {
  if (!e.alive) return 'down';
  if (e.pose) return e.pose;
  if (e.hurt > 0) return 'hurt';
  if (e.broken) return 'hurt';
  // (a planned Heavy used to show its WIND pose all through the player's choice; with real pose sheets that froze big
  //  wind-ups like a fire pot's throw on screen for whole rounds, so the warning is now the red glow and the intent label, and
  //  the wind-up itself plays when the foe acts: Ash, 26 Oct 2026)
  return 'ready';
}
// a fighter's image: [canvas, scale, rot, dy] — the pose sheet when there is one, else the walking sheet's side frame bent
// into the pose (lean back for the wind-up, forward for the cut, back for a hit)
const FAKE_POSE = { ready: [0, 0], wind: [0.12, 0], cut: [-0.2, 1], hurt: [0.2, 0], guard: [-0.04, 0], down: [0, 0] };
function memberBattleSprite(p) {
  // running away: the walking sheet's right-facing side frames (their backs to the foe)
  if (p.flee && up(p)) {
    const f = p.m === G.hero ? heroSprite(3, p.fr) : castSprite(memberCast(p.m), 3, p.fr);
    if (f) return [f, BS / (f.q || 1), 0, false, 0.5];
  }
  // a knock-down holds its last drawing only while the fighter is down; anything else gives way to the down pose
  if (p.clip && (p.clip.c === 'hit' && p.clip.ph === 'heavy' ? up(p) : !up(p) && p.clip.ph !== 'rise')) p.clip = null;
  const cs = clipSprite(p, false); if (cs) return [cs, BS / cs.q, 0, true, cs.ax];
  const pose = partyPose(p), ps = poseSprite(memberCastId(p.m), pose, false);
  if (ps) return [ps, BS / ps.q, 0, true, POSE_AX];
  const fr = p.fr, s = p.m === G.hero ? heroSprite(2, fr) : castSprite(memberCast(p.m), 2, fr);
  const rot = FAKE_POSE[pose] ? FAKE_POSE[pose][0] : 0;
  if (s) return [s, BS / (s.q || 1), rot, false];
  const br = Math.floor(B.at / 20) % 2;
  return [scaledCached('hero' + fr + br, () => charSprite(HERO_SPR, 2, fr, br), 1), 1, rot, false];
}
function enemyBattleSprite(e) {
  const d = e.d, ec = enemyCast(e.id);
  let pose = enemyPose(e);
  // a flyer's sheet draws the two halves of its hover flap as READY (wings up) and GUARD (wings down)
  if ((d.kind === 'crow' || d.kind === 'bat') && pose === 'ready' && Math.floor(B.at / 8) % 2) pose = 'guard';
  if (ec) {
    // a drawn clip first (Job 17); a broken foe with a hit strip holds its staggered knee
    if (e.clip && (e.clip.c === 'hit' && e.clip.ph === 'heavy' ? e.alive : !e.alive)) e.clip = null;
    const cs = clipSprite(e, true) || (e.broken && e.alive && clipDef(ec[0], 'hit') ? clipFrame(ec[0], 'hit', clipTable().sheets[ec[0]].hit.ph.broken[0], true) : null);
    if (cs) return [cs, BS * ec[1] / cs.q, 0, true, cs.ax];
    const ps = poseSprite(ec[0], pose, true); if (ps) return [ps, BS * ec[1] / ps.q, 0, true, 1 - POSE_AX];
    const s = castSprite(ec[0], 3, 0); if (s) return [s, BS * ec[1] / (s.q || 1), -(FAKE_POSE[pose] ? FAKE_POSE[pose][0] : 0), false];
  }
  if (d.kind) { const fr = (d.kind === 'crow' || d.kind === 'bat') ? Math.floor(B.at / 8) % 2 : Math.floor(B.at / 20) % 2; return [scaledCached('k' + d.kind + fr, () => creatureSprite(d.kind, fr, true), 1), 1, -(FAKE_POSE[pose] ? FAKE_POSE[pose][0] * 0.6 : 0), false]; }
  const tf = d.char.torch ? '_' + (Math.floor(B.at / 6) % 3) : '';
  const br = Math.floor(B.at / 24) % 2;
  return [scaledCached('c' + e.id + tf + br, () => charSprite(d.char, 3, 0, br, d.scale ? 1.9 : 1), 1), 1, -(FAKE_POSE[pose] ? FAKE_POSE[pose][0] : 0), false];
}
// ---------------- ink ----------------
function inkSlash(x, y, g, wide) {
  const big = g === 'perfect', len = (big ? 96 : 70) * (wide ? 1.15 : 1), a = -0.75 + rnd(-0.18, 0.18);
  B.fx.push({ type: 'ink', x0: x - Math.cos(a) * len / 2, y0: y - Math.sin(a) * len / 2 - 6, x1: x + Math.cos(a) * len / 2, y1: y + Math.sin(a) * len / 2 + 6, w: big ? 13 : 9, red: big || g === 'good', t: 0, life: 30, seed: ri(1, 999) });
  spatter(x, y, big ? 14 : 8, -1);
}
// ink drops thrown off a cut (dir: -1 to the left, 1 to the right)
function spatter(x, y, n, dir) {
  for (let i = 0; i < n; i++) B.fx.push({ type: 'drop', x: x + rnd(-6, 6), y: y + rnd(-6, 6), vx: dir * rnd(0.6, 3.2) + rnd(-0.8, 0.8), vy: rnd(-3.4, -0.6), r: rnd(1, 2.6), t: 0, life: ri(18, 30) });
}
const cutinLen = () => cfg().speed > 1 ? 20 : 28;

// ---------------- the backdrop ----------------
function battleBackdrop() {
  if (B.bgc) return B.bgc;
  const [c, g] = mk(W * D, H * D);
  const pbg = B.opts.paintImg || (B.opts.paint && assetImg(B.opts.paint));
  g.imageSmoothingEnabled = true;
  try { g.filter = 'blur(1.2px) saturate(0.9) brightness(0.92)'; } catch (e) {}
  if (B.stage) { g.save(); g.scale(D, D); battleSceneView(g, B.stage.win); g.restore(); }   // the scene's window, its sky layers behind (job battle-place)
  else if (pbg) { if (B.opts.crop) { const k = B.opts.crop; g.drawImage(pbg, k[0], k[1], k[2], k[3], 0, 0, W * D, H * D); } else g.drawImage(pbg, 0, 0, W * D, H * D); }
  else g.drawImage(battleBackdropArt(B.bg), 0, 0, W * D, H * D);
  g.filter = 'none';
  if (pbg && B.opts.crop) { g.fillStyle = 'rgba(14,10,24,.18)'; g.fillRect(0, 0, W * D, H * D); }
  B.bgc = c; return c;
}
// a fight on its own scene (job battle-place): the scene's parallax layers (a sky behind the painting's transparent top) and the painting,
// for the world rect c = [x, y, w, h], onto g in battle screen px. The layers sit where the field camera would have them with its view
// centred on c, so the sky is the one the player was just looking at.
function battleSceneView(g, c) {
  const iw = SC.img.width / SC.ww, P = SC.def.parallax;
  g.save(); g.scale(W / c[2], H / c[3]); g.translate(-c[0], -c[1]);
  if (P && P.length && typeof parallaxRect === 'function') {
    g.fillStyle = SC.def.bg || '#241a2c'; g.fillRect(c[0], c[1], c[2], c[3]);
    const camX = c[0] + c[2] / 2 - W / 2, camY = c[1] + c[3] / 2 - H / 2;
    const cax = SC.ww > W ? clamp(camX, 0, SC.ww - W) : 0, cay = SC.wh > H ? clamp(camY, 0, SC.wh - H) : 0;
    for (const l of P) { const r = parallaxRect(l, camX, camY); if (!r) continue; g.globalAlpha = l.alpha == null ? 1 : l.alpha; g.drawImage(r[4], r[0] + cax, r[1] + cay, r[2], r[3]); }
    g.globalAlpha = 1;
  }
  g.drawImage(SC.img, c[0] * iw, c[1] * iw, c[2] * iw, c[3] * iw, c[0], c[1], c[2], c[3]);
  g.restore();
}
// The walk onto the marks (job battle-place). B.tr = { t, len, c0: the field view, c1: the fight's window } (world rects). trView() is the
// window this frame (null once it is done); trAt(b) is where fighter b is drawn this frame [x, y, scale] (battle screen px): from where it
// stood on the map (B.stage.from) to its mark, carried by the camera as it eases in, its sprite growing with the zoom.
const trEase = u => u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
function trView() {
  const r = B.tr; if (!r || r.t >= r.len || !B.stage) return null;
  const u = trEase(clamp(r.t / r.len, 0, 1));
  return r.c0.map((v, i) => v + (r.c1[i] - v) * u);
}
function trAt(b, c) {
  const st = B.stage, fr = st.from.get(b); if (!fr) return null;
  const r = B.tr, lead = b === B.party[0] || b === st.lead;
  // the hero and the foe he met set off at once, quickly; the others run the whole way in
  const u = clamp((r.t - (lead ? 0 : 2)) / (r.len * (lead ? 0.7 : 0.95)), 0, 1), p = 1 - Math.pow(1 - u, 3);
  const to = [st.win[0] + b.x / st.zx, st.win[1] + b.y / st.zy];
  const wx = fr[0] + (to[0] - fr[0]) * p, wy = fr[1] + (to[1] - fr[1]) * p;
  const kx = W / c[2], ky = H / c[3], run = u > 0 && u < 1 ? Math.abs(Math.sin(u * Math.PI * 4)) * 2.5 : 0;
  return [(wx - c[0]) * kx, (wy - c[1]) * ky - run, kx / st.zx];
}
// the field view easing in: the sharp painting (and its sky and water) at this frame's window, darkened and softened into the fight's
// own backdrop over the last frames
function drawTrBackdrop(c, sx, sy) {
  L.save(); L.translate(sx, sy); L.imageSmoothingEnabled = true; battleSceneView(L, c); L.restore();
  drawBattleWater(sx, sy, c);
  const u = B.tr.t / B.tr.len;
  L.fillStyle = `rgba(14,10,24,${(0.18 * trEase(u)).toFixed(3)})`; L.fillRect(0, 0, W, H);
  if (u > 0.8) { L.globalAlpha = (u - 0.8) / 0.2; L.imageSmoothingEnabled = true; L.drawImage(battleBackdrop(), sx, sy, W, H); L.globalAlpha = 1; }
}
// bats and crows are dark on dark ground: a pale 1-art-px rim under their sprite (job battle-place)
const FLIER_RIM = new WeakMap();
function flierRim(s) {
  let c = FLIER_RIM.get(s); if (c) return c;
  const [cc, g] = mk(s.width + 2, s.height + 2);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.drawImage(s, 1 + dx, 1 + dy);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = UI.paper || '#f4ecd8'; g.fillRect(0, 0, cc.width, cc.height);
  FLIER_RIM.set(s, cc); return cc;
}
// Water polish (30 Oct 2026): a fight that started in a painted scene uses a still crop of that painting, so its water stopped dead. The
// scene's water loops (05c drawWaterLoops) are drawn over the crop the way the backdrop is made: same place, darkened by the same wash,
// softened by the same blur.
function drawBattleWater(sx, sy, view) {
  const o = B.opts; if (!o.crop || typeof SC !== 'object' || o.paintImg !== SC.img || !(SC.wl || []).length || typeof drawWaterLoops !== 'function') return;
  const iw = SC.img.width / SC.ww, k = view ? view.map(v => v * iw) : o.crop, cx = k[0] / iw, cy = k[1] / iw, kx = W / (k[2] / iw), ky = H / (k[3] / iw);
  const [c, g] = B.wc || (B.wc = mk(W * D, H * D));
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W * D, H * D); g.imageSmoothingEnabled = false;
  g.setTransform(D * kx, 0, 0, D * ky, -cx * D * kx, -cy * D * ky);
  drawWaterLoops(cx, cy, iw, g);
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(14,10,24,.18)'; g.fillRect(0, 0, W * D, H * D); g.globalCompositeOperation = 'source-over';
  L.save(); L.imageSmoothingEnabled = true; try { L.filter = 'blur(0.6px) saturate(0.9) brightness(0.92)'; } catch (e) {}
  L.drawImage(c, sx, sy, W, H); L.restore();
}
// the standoff's version of the backdrop (e.g. an ink wash on washi), made once per fight by the theme
function battleInk() { return B.bgInk || (B.bgInk = themeUI('battleBackdrop')(battleBackdrop())); }

function drawBattle() {
  const sx = B.shake ? ri(-3, 3) : 0, sy = B.shake ? ri(-2, 2) : 0;
  L.fillStyle = '#07060a'; L.fillRect(0, 0, W, H);
  const impact = B.impact > 0, tv = trView(), tvAt = tv || (B.tr && B.impact > 0 && B.tr.t === 0 ? B.tr.c0 : null);
  L.save();
  if (B.zoom && !impact) { const z = B.zoom, k = 1 + (z.k - 1) * Math.pow(1 - z.t / z.dur, 2); L.translate(z.x, z.y); L.scale(k, k); L.translate(-z.x, -z.y); }
  if (impact) themeUI('battleImpact')(L);
  else {
    L.imageSmoothingEnabled = true;
    if (tv) drawTrBackdrop(tv, sx, sy);
    else { L.drawImage(battleBackdrop(), sx, sy, W, H); drawBattleWater(sx, sy); }
    if (B.ink > 0) { L.globalAlpha = B.ink; L.drawImage(battleInk(), sx, sy, W, H); L.globalAlpha = 1; }
    L.imageSmoothingEnabled = false;
    if (!B.opts.paintImg && !B.opts.paint) drawBattleAmbient(B.bg, B.t);
    if (B.opts.fog && typeof drawFog === 'function') drawFog(L, B.opts.fog);
  }
  const intro = B.phase === 'intro' && !B.tr ? Math.max(0, 1 - B.t / 22) : 0;
  const drawShadow = (x, y, w) => { if (B.tr && B.tr.t < B.tr.len) w = Math.round(w); L.drawImage(shadowSprite(w, Math.max(6, w * 0.28)), Math.round(x - w / 2), Math.round(y - w * 0.14)); };
  const inStand = B.so && !B.so.res;
  const acts = [];
  // one fighter: its feet at (fx, fy); rot bends a side frame into a pose around the feet
  // a pose sheet breathes (a slow stretch about the feet) and settles with a small squash whenever the pose changes;
  // a side frame bobs instead (bob)
  const put = (s, sc, rot, fx, fy, bob, alpha, flash, isPose, ax, who) => {
    const w = s.width * sc, h = s.height * sc, img = impact ? themeUI('battleSil')(s) : s, axw = w * (ax == null ? 0.5 : ax);
    let ky = 1, kx = 1;
    if (isPose && who) {
      if (who._pose !== s) { who._fromClip = !!(who._pose && who._pose.clip); who._pose = s; who._poseT = 0; } else who._poseT = (who._poseT || 0) + (B.stop ? 0 : 1);
      // a clip draws its own motion: no settle squash on its frames, nor as it hands back to the pose sheet
      const st = who._poseT < 7 && !s.clip && !who._fromClip ? Math.sin(who._poseT / 7 * Math.PI) * 0.06 : 0;
      const br = s === who._ready ? Math.sin(B.at / 24 + fx * 0.05) * 0.014 : 0;
      ky = 1 - st + br; kx = 1 + st * 0.6 - br * 0.5; bob = 0;
    }
    const motion = who ? fxMotion(who) : { rot: 0, sx: 1, sy: 1 };
    rot += motion.rot; kx *= motion.sx; ky *= motion.sy;
    L.save(); L.globalAlpha = alpha; L.translate(Math.round(fx), Math.round(fy + bob)); if (rot) L.rotate(rot); if (ky !== 1 || kx !== 1) L.scale(kx, ky);
    if (who && isFlier(who) && !impact) { const q = w / s.width; L.globalAlpha = alpha * 0.55; drawSpr(L, flierRim(s), -axw - q, -h - q, w + 2 * q, h + 2 * q); L.globalAlpha = alpha; }
    drawSpr(L, img, -axw, -h, w, h);
    if (flash && !impact) { L.globalCompositeOperation = 'lighter'; drawSpr(L, s, -axw, -h, w, h); drawSpr(L, s, -axw, -h, w, h); L.globalCompositeOperation = 'source-over'; }
    L.restore(); L.globalAlpha = 1;
    return [w, h];
  };
  for (const e of B.enemies) {
    if (e.fade <= 0) continue;
    acts.push({ y: tvAt && trAt(e, tvAt) ? trAt(e, tvAt)[1] : e.y, f: () => {
      const [s, sc, rot, isPose, ax] = enemyBattleSprite(e), fly = e.d.kind === 'crow' || e.d.kind === 'bat';
      const ta = tvAt && trAt(e, tvAt), tk = ta ? ta[2] : 1, gy = ta ? ta[1] : e.y;   // the walk onto the marks: where it is this frame
      const ex = (ta ? ta[0] : fxX(e)) + sx - intro * 260 + (inStand && B.so.flick ? (B.so.flick % 2 ? 3 : -3) : 0);
      const bob = (fly ? Math.sin(B.at / 8 + e.x) * 4 - 26 : Math.sin(B.at / 20 + e.x) * 0.6) * tk;
      if (!impact) { L.globalAlpha = e.fade; drawShadow(ex, gy, Math.min(s.width * sc * 0.8, e.d.scale ? 80 : fly ? 26 : e.d.kind ? 46 : 60) * tk); L.globalAlpha = 1; }
      // a Heavy winding up glows red; a broken foe shows a grey haze
      if (!impact && e.alive && (enemyPose(e) === 'wind' || (e.plans && e.plans.some(p => p.heavy) && choosingPhase()))) { L.globalCompositeOperation = 'lighter'; L.globalAlpha = 0.35 + Math.sin(B.at / 5) * 0.15; L.drawImage(glowSprite(46, '#ff4020'), ex - 46, e.y - s.height * sc * 0.55 - 46); L.globalAlpha = 1; L.globalCompositeOperation = 'source-over'; }
      if (isPose && enemyCast(e.id)) e._ready = poseSprite(enemyCast(e.id)[0], 'ready', true);
      const ey = ta ? gy : e.y - (e.offY || 0) + fxMotion(e).y;
      const [w, h] = put(s, sc * tk, rot, ex, ey, bob, e.fade, e.flash > 0 && e.flash % 4 < 2, isPose, ax, e);
      e.sx = ex; e.sy = ey - h + bob; e.sh = h;
    } });
  }
  B.party.forEach((p, i) => acts.push({ y: tvAt && trAt(p, tvAt) ? trAt(p, tvAt)[1] : p.y, f: () => {
    const [s, sc0, rot, isPose, ax] = memberBattleSprite(p);
    if (isPose) p._ready = poseSprite(memberCastId(p.m), 'ready', false);
    const ta = tvAt && trAt(p, tvAt), tk = ta ? ta[2] : 1, sc = sc0 * tk, gy = ta ? ta[1] : p.y;   // the walk onto the marks
    const hx = (ta ? ta[0] : fxX(p)) + sx + intro * 200, footY = ta ? gy : fxFootY(p);
    if (inStand && i > 0) L.globalAlpha = 0.5;
    if (!up(p) && !isPose) {   // down, with no pose sheet: lying on the ground, dimmed
      const w = s.width * sc, h = s.height * sc;
      L.save(); L.globalAlpha = 0.75; L.translate(Math.round(hx), p.y); L.rotate(-Math.PI / 2); drawSpr(L, impact ? themeUI('battleSil')(s) : s, -w * 0.3, -h / 2, w, h); L.restore(); L.globalAlpha = 1;
      p.sx = hx; p.sy = p.y - 30; return;
    }
    if (!impact) {
      drawShadow(hx, gy, 40 * tk);
      if (p.guard > 0 || p.cover > 0) { L.globalCompositeOperation = 'lighter'; L.globalAlpha = 0.35 + Math.sin(B.at / 6) * 0.12; L.drawImage(glowSprite(40, p.cover > 0 ? '#ffd080' : p.stone ? '#9a948a' : '#80b0ff'), hx - 40, p.y - s.height * sc / 2 - 40); L.globalAlpha = 1; L.globalCompositeOperation = 'source-over'; }
    }
    const bob = p.flee && up(p) ? -(p.fr === 1 ? 2 : 0) : up(p) ? Math.round(Math.sin(B.at / 18 + p.x)) : 0;
    const blink = p.flash > 0 && p.flash % 4 < 2;
    const [w, h] = blink && !impact ? [s.width * sc, s.height * sc] : put(s, sc, rot, hx, footY, bob, up(p) ? (inStand && i > 0 ? 0.5 : 1) : 0.8, false, isPose, ax, p);
    L.globalAlpha = 1;
    p.sx = hx; p.sy = footY - h + bob;
  } }));
  acts.sort((a, b) => a.y - b.y);
  drawFxLayer('ground', impact);   // ripples, cracks, scorch marks, auras and afterimages under the fighters (07d)
  for (const a of acts) a.f();
  // effects
  for (const f of B.fx) if (!f.layer) drawBattleFx(L, f, impact);   // the effects over the fighters, each drawn by the theme (07d)
  L.restore();
  if (!impact) L.drawImage(vignette(), 0, 0);
  drawFxLayer('screen', impact);   // across the whole frame: flash lines, washes, the cleave's split, 'Kneel!'
  // the standoff: letterbox and wind
  if (B.so && (inStand || B.ink > 0)) {
    const k = inStand ? Math.min(1, B.so.t / 30) : B.ink, bar = 40 * k;
    L.fillStyle = '#07060a'; L.fillRect(0, 0, W, bar); L.fillRect(0, H - bar, W, bar);
    if (inStand) themeUI('standoffWind')(L, B.so.t);
  }
  // the wipe into the fight
  if (B.wipe < 24 && !B.so) themeUI('battleWipe')(L, Math.pow(B.wipe / 24, 0.8));
}

function memberPortrait(m) { return m === G.hero ? portrait(HERO_SPR) : assetImg('portrait_' + allyDef(m.id).cast); }
function drawBattleUI() {
  if (B.impact > 0) return;   // the impact frame is ink and paper only
  if (B.tr && B.tr.t < B.tr.len) return;   // the walk onto the marks: the panels come up once everyone is on their mark
  const p = actor(), m = p ? p.m : G.hero;
  const choosing = choosingPhase();
  const inStand = B.so && !B.so.res;
  // enemy HP and posture bars, Broken / Reeling
  for (const e of B.enemies) {
    if (!e.alive || e.sx == null || B.phase === 'intro' || inStand) continue;
    gauge(e.sx - 20, e.y + 6, 40, e.hp, e.maxHp, '#e0604a', 3);
    // posture: an ink bar that empties as the guard cracks
    const px = (e.sx - 20) * S, py = (e.y + 12) * S, pw = 40 * S, f = e.broken ? 0 : clamp(e.post / e.postMax, 0, 1);
    X.fillStyle = 'rgba(20,14,10,.55)'; X.fillRect(px, py, pw, 2 * S);
    X.fillStyle = f < 0.34 ? '#e0a050' : '#e8dcc0'; X.fillRect(px, py, pw * f, 2 * S);
    if (e.broken) { X.fillStyle = UI.seal; X.fillRect(px, py, pw, 2 * S); }
    if (choosing || B.phase === 'busy') {
      let label = null, col = UI.ink;
      if (e.broken) { label = e.skip ? 'Broken' : 'Reeling'; col = UI.seal; }
      // (the move-intent labels, "Cut + Cut" / "Fire pot ▸ the hero", were removed at Ash's request on 26 Oct 2026: a planned
      //  Heavy still glows red; only a foe's Broken / Reeling state is labelled)
      if (label) { const tw = txtW(label, 10) + 16, tx = e.sx - tw / 2, ty = Math.max(46, e.sy - 20); win(tx, ty, tw, 13, 1); txt(label, e.sx, ty + 1, col, 10, 'center'); }
    }
  }
  // who each foe means to strike: small red seals over the party (removed with the intent labels, Ash, 26 Oct 2026)
  if (false) {
    const marks = new Map();
    for (const e of alive()) if (!e.broken) for (const pl of e.plans || []) { const tg = planTarget({ tgt: pl.tgt }); if (tg) marks.set(tg, (marks.get(tg) || 0) + (pl.heavy ? 2 : 1)); }
    for (const [tg, n] of marks) if (tg.sx != null) for (let i = 0; i < Math.min(3, n); i++) uiMark(tg.sx - (Math.min(3, n) - 1) * 5 + i * 10, tg.sy - 8 + Math.sin(frame / 8) * 1.2, 3.4, 0.9);
  }
  // pops (damage numbers in brush type)
  for (const pp of B.pops) {
    const y = pp.y - Math.min(20, pp.t * 1.1), a = pp.t > 40 ? Math.max(0, 1 - (pp.t - 40) / 20) : 1;
    X.globalAlpha = a;
    if (pp.big) {
      // a critical or perfect hit (huge): a larger number with a vermilion brush stroke drawn under it (Job 11z)
      const sz = pp.huge ? 30 : pp.text.length > 5 ? 15 : 22;
      X.save(); X.font = `800 ${Math.round(sz * S)}px ${FONT_HEAD}`; X.textAlign = 'center'; X.textBaseline = 'top'; X.lineWidth = pp.huge ? 6 : 5; X.strokeStyle = '#140c0a'; X.lineJoin = 'round'; X.strokeText(pp.text, pp.x * S, y * S); X.fillStyle = pp.col; X.fillText(pp.text, pp.x * S, y * S);
      if (pp.huge) { const tw = X.measureText(pp.text).width; X.fillStyle = UI.seal; X.fillRect(pp.x * S - tw / 2, (y + sz + 1) * S, tw * Math.min(1, pp.t / 8), 2 * S); }
      X.restore();
    }
    else outlineTxt(pp.text, pp.x, y, pp.col, pp.text.length > 5 ? 13 : 20);
    X.globalAlpha = 1;
  }
  // the timing ring
  const tm = B.tm;
  if (tm && !tm.res && (B.phase === 'busy')) {
    const total = Math.max(1, tm.at - tm.from), k = clamp((tm.at - B.tick) / total, 0, 1);
    if (tm.kind === 'release') {
      if (B.tick >= tm.at) { uiMark(tm.x, tm.y, 6); }
    } else if (timingRing()) {
      const r = 5 + 36 * k, cx = tm.x * S, cy = tm.y * S;
      X.save(); X.lineWidth = 3.2 * S; X.strokeStyle = 'rgba(18,12,10,.85)'; X.beginPath(); X.arc(cx, cy, r * S, 0, 6.283); X.stroke();
      X.lineWidth = 1.2 * S; X.strokeStyle = k < 0.15 ? '#fff4d0' : 'rgba(245,236,216,.9)'; X.beginPath(); X.arc(cx, cy, r * S, 0, 6.283); X.stroke(); X.restore();
      uiMark(tm.x, tm.y, 3.6, 0.95);
    }
    if (G.f && (G.f.tmN || 0) < 3 && tm.kind === 'press') headTxt(Input.touchMode ? 'Tap A as the ring closes!' : `Press ${keyName('a')} as the ring closes!`, 320, 58, '#f6e4b0', 12, 'center', 700);
    if (G.f && (G.f.tmN || 0) < 3 && tm.kind === 'beat') headTxt(Input.touchMode ? 'Tap A on the beat!' : `Press ${keyName('a')} on the beat!`, 320, 58, '#f6e4b0', 12, 'center', 700);
  }
  // the standoff prompt
  if (inStand) {
    const so = B.so;
    headTxt(B.enemies[0].d.name, 320, 52, UI.ink, 18, 'center', 800, null);
    if (so.t > 30) headTxt(so.held ? 'Wait for the steel to flash ... release!' : `Hold ${keyName('a')}.`, 320, 300, UI.cream, 13, 'center', 700);
    return;
  }
  if (B.msg) { const ls = wrap(B.msg, 440, 13).slice(0, 2); const w = Math.max(...ls.map(l => txtW(l, 13))) + 48; win(320 - w / 2, 12, w, 18 + ls.length * 19); ls.forEach((l, i) => txt(l, 320, 21 + i * 19, '#f4ecd8', 13, 'center')); }
  if (B.coach) { const ls = wrap(B.coach.text, 420, 11).slice(0, 2), w = Math.max(...ls.map(l => txtW(l, 11))) + 40; win(320 - w / 2, 214, w, 12 + ls.length * 15, 1); ls.forEach((l, i) => txt(l, 320, 220 + i * 15, '#f4ecd8', 11, 'center')); }
  // the cut-in band: the fighter's eyes and the technique's name
  for (const tg of B.tags) drawTechTag(tg);
  if (B.cut) drawCutIn(B.cut);
  // commands (with whose turn it is, when there is more than one)
  win(16, 262, 170, 86);
  if (!solo() && choosing && p) { setFont(12, true); const nw = X.measureText(p.name).width / S + 34; win(24, 245, nw, 22, 1); txt(p.name, 41, 250, '#f6d890', 12); }
  if (B.phase === 'cmd' || B.phase === 'tech' || B.phase === 'item' || (B.phase === 'ally' && !solo())) {
    battleCommands().forEach((c, i) => { const on = i === B.sel; txt(c, 44, 268 + i * 15.5, on ? '#fff' : '#a89c84', 12); if (on && B.phase === 'cmd') cursor(24, 268 + i * 15.5); });
  } else B.enemies.filter(e => e.alive).slice(0, 4).forEach((e, i) => txt(e.name, 30, 270 + i * 19, B.phase === 'target' && alive()[B.target] === e ? '#fff' : '#d8ccb0', 12));
  // party panel
  win(372, 262, 252, 86);
  if (solo()) {
    const h = G.hero, st = heroStats(h);
    X.imageSmoothingEnabled = false; X.drawImage(portrait(HERO_SPR), 380 * S, 268 * S, 72 * S, 72 * S);
    txt(GAME.hero.name, 458, 270, '#f6d890', 14); txt('Lv ' + h.lv, 606, 272, '#f4ecd8', 12, 'right');
    txt('HP', 458, 294, '#a89c84', 11); txt(`${h.hp}/${st.maxHp}`, 606, 292, h.hp < st.maxHp * 0.3 ? '#ff8060' : '#f4ecd8', 13, 'right'); gauge(458, 309, 148, h.hp, st.maxHp, '#e0604a');
    txt('Ki', 458, 318, '#a89c84', 11); txt(`${h.ki}/${st.maxKi}`, 606, 316, '#f4ecd8', 13, 'right'); gauge(458, 333, 148, h.ki, st.maxKi, '#5aa8e0');
    const bp = B.party[0], tags = []; if (bp.guard > 0) tags.push(['Guard', '#a0c8f0']); if (bp.debuff > 0) tags.push(['Shaken', '#d8a0f0']);
    tags.forEach(([t, c], i) => { win(372 + i * 70, 236, 64, 22, 0); txt(t, 404 + i * 70, 241, c, 11, 'center'); });
  } else {
    // one row per member: small portrait, name, HP and Ki
    B.party.forEach((bp, i) => {
      const mm = bp.m, st = memberStats(mm), y = 267 + i * 27, on = bp === p && choosing, isUp = up(bp);
      if (on) selBar(378, y - 2, 240, 25);
      const pim = memberPortrait(mm); if (pim) { X.imageSmoothingEnabled = false; X.globalAlpha = isUp ? 1 : 0.45; X.drawImage(pim, 382 * S, (y - 1) * S, 22 * S, 22 * S); X.globalAlpha = 1; }
      txt(bp.name, 410, y + 1, isUp ? '#f6d890' : '#8a7e66', 12);
      const tag = !isUp ? ['Down', '#9a3a2a'] : bp.cover > 0 ? ['Rearguard', '#7a5a14'] : bp.guard > 0 ? ['Guard', '#2f4f7a'] : bp.debuff > 0 ? ['Shaken', '#5e3a7a'] : null;
      if (tag) txt(tag[0], 410, y + 14, tag[1], 9);
      txt(`${mm.hp}`, 512, y, mm.hp < st.maxHp * 0.3 ? '#ff8060' : '#f4ecd8', 12, 'right'); txt('HP', 470, y + 2, '#a89c84', 9); gauge(470, y + 16, 44, mm.hp, st.maxHp, '#e0604a', 3);
      txt(`${mm.ki}`, 612, y, '#f4ecd8', 12, 'right'); txt('Ki', 570, y + 2, '#a89c84', 9); gauge(570, y + 16, 44, mm.ki, st.maxKi, '#5aa8e0', 3);
    });
  }
  if (B.phase === 'tech' || B.phase === 'item') {
    const list = B.phase === 'tech' ? m.techs : invList().filter(i => !contentGet('items', i).key);
    const vis = 4, start = clamp(B.sub - 1, 0, Math.max(0, list.length - vis));
    win(194, 238, 170, 110);
    list.slice(start, start + vis).forEach((id, k) => {
      const i = start + k, y = 250 + k * 22, on = i === B.sub;
      const name = B.phase === 'tech' ? contentGet('techniques', id).name : contentGet('items', id).name, right = B.phase === 'tech' ? contentGet('techniques', id).ki + ' Ki' : '×' + G.inv[id];
      const dim = B.phase === 'tech' && m.ki < contentGet('techniques', id).ki;
      const tIcon = B.phase === 'tech' && assetImg('icon_tech_' + id);   // Job 12j: technique icon when the art exists
      if (B.phase === 'item') itemIcon(id, 217, y - 3, 18); else if (tIcon) itemIcon('tech_' + id, 217, y - 3, 18);
      txt(name, B.phase === 'item' || tIcon ? 238 : 222, y, on ? (dim ? '#8a7e66' : '#fff') : '#a89c84', 12); txt(right, 354, y, dim ? '#6a5a48' : '#90c0e8', 11, 'right'); if (on) cursor(202, y + 1);
    });
    const id = list[B.sub]; if (id && B.msg !== 'Not enough Ki.') { const d = (B.phase === 'tech' ? contentGet('techniques', id) : contentGet('items', id)).desc; const ls = wrap(d, 440, 12).slice(0, 2), w = Math.max(...ls.map(l => txtW(l, 12))) + 48; win(320 - w / 2, 12, w, 16 + ls.length * 18); ls.forEach((l, i) => txt(l, 320, 21 + i * 18, '#f4ecd8', 12, 'center')); }
  }
  if (B.phase === 'cmd' && COMMANDS[B.sel] === 'Guard') { const s = 'Brace: half damage until your next turn, and gather 2 Ki.', w = txtW(s, 12) + 48; win(320 - w / 2, 12, w, 34); txt(s, 320, 21, '#f4ecd8', 12, 'center'); }
  if (B.phase === 'target') {
    const e = alive()[B.target];
    if (e && e.sy != null) { const b = Math.sin(frame / 6) * 2, x = e.sx, y = e.sy - 12 + b; uiMark(x, y + 2, 5); const s = `${e.name}   HP ${e.hp}/${e.maxHp}   Posture ${e.broken ? 'broken' : e.post + '/' + e.postMax}`, w = txtW(s, 13) + 48; win(320 - w / 2, 12, w, 32); txt(s, 320, 20, '#f4ecd8', 13, 'center'); }
  }
  if (B.phase === 'ally') {
    const a = B.allyList[B.ally];
    if (a && a.sx != null) { const b = Math.sin(frame / 6) * 2; uiMark(a.sx, a.sy - 10 + b, 5); const st = memberStats(a.m), s = `${a.name}   HP ${a.m.hp}/${st.maxHp}   Ki ${a.m.ki}/${st.maxKi}`, w = txtW(s, 13) + 48; win(320 - w / 2, 12, w, 32); txt(s, 320, 20, '#f4ecd8', 13, 'center'); }
  }
  if (B.phase === 'win' && B.msg) { const ls = wrap(B.msg, 440, 13).slice(0, 2), w = Math.max(...ls.map(l => txtW(l, 13))) + 48; moreMark(320 + w / 2 - 14, 12 + 18 + ls.length * 19 - 12); }
  if (B.phase === 'lose' && B.t > 60) {
    const x = 240, y = 120, w = 160;
    win(x, y, w, 64);
    ['Try again', B.opts.duel ? 'Leave the bout' : GAME.gameOver.leave || 'Give up'].forEach((o, i) => { const on = i === B.loseSel; txt(o, x + 40, y + 12 + i * 22, on ? '#fff' : '#a89c84', 13); if (on) cursor(x + 18, y + 13 + i * 22); });
  }
}
// a technique's name across the screen (every use) and a fighter's signature band (techIntro in 07_battle.js): the theme draws both
// (e.g. cream brush type over a torn ink band with a vermilion stroke under the name; themes/ink-washi/battle_fx.js)
function drawTechTag(tg) { themeUI('techTag')(tg); }
function drawCutIn(c) { themeUI('cutIn')(c, cutinLen()); }

// Job fw-F2: the turn-based battle kit's mode
defineMode('battle', { kit: 'battle-turn', update: () => SPOT_EDIT.on ? spotEditUpdate() : battleUpdate(), art: () => drawBattle(), ui: () => { if (SPOT_EDIT.on) spotEditGround(); drawBattleUI(); if (SPOT_EDIT.on) spotEditDraw(); } });   // the battle spot editor holds the fight (07e)
