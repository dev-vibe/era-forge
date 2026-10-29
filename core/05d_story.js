// ============================================================
//  Story in the painted scenes (Job 8b, 10 Oct 2026)
//  NPCs standing in painted scenes, per-scene story hooks (onEnter scripts with once-flags, exit overrides),
//  extra script steps (scene change, wait, shake, white-out, fog, NPC walk, music, sfx), a drifting fog overlay,
//  and a game's playable opening, staged from its own content.
//  05c_scene.js calls into this file; everything here is data plus small helpers. Job fw-F3a: the script steps are a table
//  (STORY_STEPS, 01a_game.js); the engine's own register below, the game's in its own files next to their code.
// ============================================================

// ---------------- sprites ----------------
// (a person's walking sheet, castSprite, is in 01d_cast.js)

// ---------------- runtime state for story effects ----------------
const ST = { dim: 0, dimTo: 0, dimV: 0, wait: 0, fog: 0, fogTo: 0, fogV: 0, white: 0, whiteTo: 0, whiteV: 0, whiteWait: false, fogWait: false, shake: 0, shakeMag: 0, walkers: [],
  // Job 9 wake-up (flooded paddy at dawn): eyelid 1 = shut .. 0 = open, focus 0 = blurred .. 1 = sharp, low mist, dawn grade, camera focus, hero pose / walk
  lid: 0, lidTo: 0, lidV: 0, lidWait: false, lidKeep: false, focus: 1, focusTo: 1, focusV: 0, mist: 0, mistTo: 0, mistV: 0, dawn: 0, dawnTo: 0, dawnV: 0,
  cam: null, camEase: 0.12, poseWait: false, hw: null, drops: [], rings: [], zoom: 1, zoomTo: 1, zoomV: 0,
  // Job 8g-r1 sit-with scene (05h_bonds.js): a black fade (dark 0..1), a caption on the black ('Later.'), a night grade and a burning fire
  dark: 0, darkTo: 0, darkV: 0, darkWait: false, caption: null, night: 0, nightTo: 0, nightV: 0, fire: null, fireA: 0, fireTo: 0, fireV: 0 };

// ---------------- NPCs in painted scenes ----------------
// STORY[id].npcs: [{ id, name, x, y (painting px), dir, cast (sheet id) | spr (charSprite preset), talk: () => steps, when: () => bool,
//                    solid (default true), hidden }]
function storyNpcs(id) {
  const S_ = storyDef(id), k = SC.k; if (!S_ || !S_.npcs) return [];
  return S_.npcs.filter(n => !n.when || n.when()).map(n => ({ def: n, id: n.id, name: n.name, x: n.x * k, y: n.y * k, dir: n.dir || 0, cast: n.cast, spr: n.spr, hidden: typeof n.hidden === 'function' ? !!n.hidden() : !!n.hidden, solid: n.solid !== false, alpha: 1, moving: false, step: 0 })).map(n => (n.alpha = n.hidden ? 0 : 1, n));
}
const scNpc = id => (SC.npcs || []).find(n => n.id === id);
// solid footprint around an NPC's feet (logical px): the hero's foot probes cannot enter it
function scNpcBlocks(x, y) {
  if (!SC.npcs || !SC.npcs.length) return false;
  const f = scHK();
  for (const n of SC.npcs) if (n.solid && !n.hidden && Math.abs(x - n.x) < 8 * f && Math.abs(y - n.y) < 7 * f) return true;
  return false;
}
// the NPC the hero is facing (his examine probe lands on its body)
function scNpcAt(px, py) {
  if (!SC.npcs) return null; const f = scHK();
  for (const n of SC.npcs) if (!n.hidden && n.def.talk && px > n.x - 11 * f && px < n.x + 11 * f && py > n.y - 34 * f && py < n.y + 9 * f) return n;
  return null;
}
// returns [sprite, empty rows under the feet in sprite px]. The paper-doll placeholders are drawn 1.2x so they stand as tall as the cast sheets
// (a charSprite figure is about 75 px at SC_HERO_K, a sheet figure about 91 of its 100 px cell), and they have ~6 px of room under the feet.
function npcSprite(n) {
  if (n.def && n.def.sprite) { const c = n.def.sprite(n); if (c) return [c, 0]; }   // Job 16c: an NPC with its own sprite (a festival wrestler in his loincloth)
  const fr = n.moving ? [1, 0, 3, 0][Math.floor(n.step / 7) % 4] : 0, cs = n.cast && castSprite(n.cast, n.dir, fr);
  if (cs) return [cs, 0];
  return [charSprite(n.spr || gameHook('npcSpec', n) || { cast: n.id }, n.dir, fr, !n.moving && Math.floor((frame + n.x) / 40) % 2 ? 1 : 0, SC_HERO_K * 1.2), 6];
}
function npcTalk(n) {
  const h = SC.hero, dx = h.x - n.x, dy = h.y - n.y;
  n.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : (dy < 0 ? 1 : 0);
  G.talkSpr = null; sfx('ok');
  if (G.f && n.id) G.f['met_' + n.id] = 1;   // Job 12a: who the hero has spoken to (the Chronicle's People page)
  run(n.def.talk(n) || []);
}

// ---------------- script steps: the engine's own (job fw-F3a; the table is STORY_STEPS in 01a_game.js) ----------------
// nextStep (05_field.js) asks storyStep(s), which asks STORY_STEPS in `order`. The handlers asked first (orders 100-500) register in their
// own files: the cinema layer (05l_cinema.js), the stampede (05j_stampede.js), map-scale clips (05n_mapclip.js), field skills
// (05m_fieldskills.js), the festival's { mini } (05r_festival.js). Plain steps from 1000 up, in the order the old if-chain asked them;
// the game's own steps (e.g. sit, dark, caption, night/fire, dance, dawn, pose, twitch) sit between them, registered from its content
// files. A run returns 'wait' when the step finishes later (it calls nextStep itself), 'next' when done at once.
const stEase = (k, to, time) => { ST[k + 'To'] = to; ST[k + 'V'] = Math.abs(ST[k + 'To'] - ST[k]) / Math.max(1, time || 1); };   // ST.<k> eases to `to` over `time` frames
const CORE = 'core', TOPDOWN = 'kit:topdown';
defineStep('wait', { owner: CORE, order: 1000, when: s => s.wait != null && Object.keys(s).length === 1, run: s => { ST.wait = Math.max(1, s.wait | 0); return 'wait'; } });
defineStep('scene', { owner: CORE, order: 1010, when: s => !!s.scene, run: s => {
  const go = () => { enterScene(s.scene, s.at || null); if (s.onArrive) s.onArrive(); nextStep(); };
  if (s.fade === false) { go(); return 'wait'; }
  warp(go); return 'wait';
} });
defineStep('fog', { owner: TOPDOWN, order: 1020, when: s => s.fog != null, run: s => { stEase('fog', s.fog, s.time); if (s.block) { ST.fogWait = true; return 'wait'; } return 'next'; } });
defineStep('white', { owner: CORE, order: 1030, when: s => s.white != null, run: s => { stEase('white', s.white, s.time); if (s.block !== false) { ST.whiteWait = true; return 'wait'; } return 'next'; } });
// 1040 sleep: 05i_sleep.js
defineStep('dim', { owner: CORE, order: 1050, when: s => s.dim != null, run: s => { stEase('dim', s.dim, s.time); return 'next'; } });   // evening dimming (rest-stop talks)
// 1060-1090 (a sit-with scene: sit, dark, caption, night / fire)
defineStep('shake', { owner: CORE, order: 1100, when: s => s.shake != null, run: s => { ST.shake = s.shake; ST.shakeMag = s.mag || 3; return 'next'; } });
defineStep('sfx', { owner: CORE, order: 1110, when: s => !!s.sfx, run: s => { sfx(s.sfx); return 'next'; } });
defineStep('music', { owner: CORE, order: 1120, when: s => s.music !== undefined, run: s => { playMusic(s.music); return 'next'; } });
defineStep('song', { owner: CORE, order: 1130, when: s => !!s.song, run: s => { playSong(s.song, s.singer); return 'next'; } });   // Job 8g-r3: a sung one-shot over the ducked music (01_core.js)
defineStep('songWait', { owner: CORE, order: 1140, when: s => !!s.songWait, run: s => { if (!songBusy()) return 'next'; ST.songWait = 1; return 'wait'; } });   // hold, no text box, until the song ends (confirm fades it out)
defineStep('show', { owner: TOPDOWN, order: 1150, when: s => !!s.show, run: s => { const n = scNpc(s.show); if (n) { n.hidden = false; n.alpha = s.fadeIn ? 0 : 1; n.fadeIn = s.fadeIn || 0; } return 'next'; } });
defineStep('hide', { owner: TOPDOWN, order: 1160, when: s => !!s.hide, run: s => { const n = scNpc(s.hide); if (n) n.hidden = true; return 'next'; } });
defineStep('face', { owner: TOPDOWN, order: 1170, when: s => !!s.face, run: s => { const n = scNpc(s.face); if (n) n.dir = s.dir; return 'next'; } });
defineStep('heroFace', { owner: TOPDOWN, order: 1180, when: s => s.heroFace != null, run: s => { SC.hero.dir = s.heroFace; return 'next'; } });
defineStep('refresh', { owner: TOPDOWN, order: 1190, when: s => !!s.refresh, run: s => { SC.npcs = storyNpcs(SC.id); SC.foes = storyFoes(SC.id); return 'next'; } });
// 1200 dance (a festival dance)
// Job 16b: { mini: kind, opt?, then?(value) }  a minigame (05a_minigame.js); the script waits for its result card's Continue.
// (a game's festival handler, order 500, is asked first and takes every { mini } step, splicing then()'s steps into the queue.)
defineStep('mini', { owner: CORE, order: 1210, when: s => !!s.mini, run: s => { startMini(s.mini, Object.assign({}, s.opt, { onDone: v => { if (s.then) s.then(v); nextStep(); } })); return 'wait'; } });
// the script ends here; the map opens after the fade (the world map is core until job F3c moves it into the travel system)
defineStep('world', { owner: CORE, order: 1220, when: s => !!s.world, run: s => { Script.queue = []; warp(() => { G.f.from_scene = SC.id; openWorld(); }); return 'next'; } });
// { lid: 0..1, time, focus?, block? }  eyelid (1 shut, 0 open); `focus` (0 blurred .. 1 sharp) eases over the same time (drawLids, blurScreen)
defineStep('lid', { owner: CORE, order: 1230, when: s => s.lid != null, run: s => {
  stEase('lid', s.lid, s.time);
  if (s.focus != null) stEase('focus', s.focus, s.time);
  if (s.block !== false && ST.lid !== ST.lidTo) { ST.lidWait = true; return 'wait'; } return 'next';
} });
defineStep('zoom', { owner: TOPDOWN, order: 1240, when: s => s.zoom != null, run: s => { stEase('zoom', s.zoom, s.time); return 'next'; } });   // { zoom: 1.6, time } world scale about the screen centre
defineStep('mist', { owner: TOPDOWN, order: 1250, when: s => s.mist != null, run: s => { stEase('mist', s.mist, s.time); return 'next'; } });   // low mist on the ground (drawMist)
// 1260-1280 (a wake-up: dawn, pose, twitch)
// { heroWalk: [x, y] (painting px), speed, block? }  the hero walks in a straight line (scripted; no walk-mask test)
defineStep('heroWalk', { owner: TOPDOWN, order: 1290, when: s => !!s.heroWalk, run: s => {
  ST.hw = { x: s.heroWalk[0] * SC.k, y: s.heroWalk[1] * SC.k, sp: s.speed || 1.1, wait: s.block !== false };
  return s.block !== false ? 'wait' : 'next';
} });
// { cam: null | 'hero' | [x, y] (painting px) | 'npc id', ease? }  where the camera looks (null = back on the hero)
defineStep('cam', { owner: TOPDOWN, order: 1300, when: s => s.cam !== undefined, run: s => {
  ST.camEase = s.ease || 0.12;
  ST.cam = s.cam === null || s.cam === 'hero' ? null : Array.isArray(s.cam) ? { x: s.cam[0] * SC.k, y: s.cam[1] * SC.k } : { npc: s.cam };
  if (s.snap) sceneCamera(true);
  return 'next';
} });
defineStep('walk', { owner: TOPDOWN, order: 1310, when: s => !!s.walk, run: s => {
  const n = scNpc(s.walk); if (!n) return 'next';
  ST.walkers.push({ n, x: s.to[0] * SC.k, y: s.to[1] * SC.k, sp: s.speed || 1.2, wait: s.block !== false, hideAtEnd: !!s.hideAtEnd });
  return s.block !== false ? 'wait' : 'next';
} });
// the story's own layers in the painted scene (05c SCENE_SLOTS): the zoom step's world scale, low mist behind the actors and a thin veil
// in front of their lower legs, roaming foes and sparkles in the depth sort, drifting fog over everything
defineLayer('zoom', 'story.zoom', { owner: TOPDOWN, order: 100, fn: () => ST.zoom });
defineLayer('backdrop', 'mist.low', { owner: TOPDOWN, order: 500, fn: () => drawMist(0) });
defineLayer('actors', 'story', { owner: TOPDOWN, order: 100, fn: (acts, hk) => storyActs(acts, hk) });
defineLayer('world', 'mist.veil', { owner: TOPDOWN, order: 400, fn: () => drawMist(1) });
defineLayer('top', 'fog', { owner: TOPDOWN, order: 200, fn: () => { if (ST.fog > 0) drawFog(L, ST.fog); } });

// ---------------- per-frame story update (called at the top of sceneUpdate) ----------------
function storyUpdate() {
  // fog and white-out ease toward their targets
  if (ST.fog !== ST.fogTo) { ST.fog = ST.fog < ST.fogTo ? Math.min(ST.fogTo, ST.fog + ST.fogV) : Math.max(ST.fogTo, ST.fog - ST.fogV); }
  else if (ST.fogWait) { ST.fogWait = false; nextStep(); }
  if (ST.white !== ST.whiteTo) { ST.white = ST.white < ST.whiteTo ? Math.min(ST.whiteTo, ST.white + ST.whiteV) : Math.max(ST.whiteTo, ST.white - ST.whiteV); }
  else if (ST.whiteWait) { ST.whiteWait = false; nextStep(); }
  storyEase();   // (ST.shake counts down in crowdTick, 05j, which also runs under a dialog box); eyelid, focus, mist, dawn grade and the scripted hero walk
  if (SC.npcs) for (const n of SC.npcs) if (n.fadeIn && n.alpha < 1) n.alpha = Math.min(n.maxA || 1, n.alpha + 1 / n.fadeIn);
  // NPC walks
  for (const w of ST.walkers.slice()) {
    const n = w.n, dx = w.x - n.x, dy = w.y - n.y, d = Math.hypot(dx, dy);
    if (d <= w.sp) {
      n.x = w.x; n.y = w.y; n.moving = false; if (w.hideAtEnd) n.hidden = true;
      ST.walkers.splice(ST.walkers.indexOf(w), 1); if (w.wait) nextStep(); continue;
    }
    n.x += dx / d * w.sp; n.y += dy / d * w.sp; n.moving = true; n.step++;
    n.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : (dy < 0 ? 1 : 0);
  }
  if (ST.wait > 0 && --ST.wait === 0) nextStep();
  if (ST.songWait && (!songBusy() || (++ST.songWait > 30 && btn('a')))) { if (songBusy()) stopSong(); ST.songWait = 0; nextStep(); }   // Job 8g-r3
  if (G.safe > 0 && G.state === 'scene') G.safe--;
  if (G.state === 'scene') { foesUpdate(); npcWander(); }
  if (typeof fsTick === 'function') fsTick();   // Job 12c: scripted walks and fades (after the foes, which stand still while a script runs)
}
// onEnter scripts: run once per flag when the scene is idle (no script, no fade, no warp)
// the per-scene test pages (window.SCENE_TEST) show the NPCs but play no story scripts and keep the scene's own exits
const storyDef = id => contentGet('story', id);   // the game's story table, by scene id (content kind `story`): npcs, foes, spots, triggers, onEnter, exit, music, fog, tod
const storyMusic = id => { const m = storyDef(id) && storyDef(id).music; return typeof m === 'function' ? m() : m; };
const storyOn = () => !window.SCENE_TEST || window.STORY_TEST;
function storyIdle() {
  const S_ = storyDef(SC.id); if (!storyOn() || !S_ || Script.active || G.fadeDir || SC.warp || G.card) return false;
  const flag = S_.flag || ('seen_' + SC.id);
  if (S_.onEnter && !G.f[flag] && !(S_.when && !S_.when())) { G.f[flag] = 1; run(S_.onEnter()); return true; }
  return storyTriggers(S_) || pressureIdle();   // Job 12b: a checkpoint of the pressure system (05_pressure.js; e.g. a checkpoint stair)
}
// an exit or door trigger may be overridden by the story: return a trigger object with `to` (warp there), an array of
// script steps (play them and push the hero back out), or null (the scene's own behaviour)
function storyExit(t) {
  const S_ = storyDef(SC.id); if (!storyOn() || !S_ || !S_.exit) return null;
  return S_.exit(t) || null;
}
function storyEnter(id) {
  const S_ = storyDef(id);
  pressureEnter(id);   // Job 12b: a new visit to the pressure system's scene (e.g. the town; patrols come back, the checkpoint asks again)
  SC.npcs = storyNpcs(id); SC.foes = storyFoes(id); ST.walkers = []; ST.shake = 0; ST.dim = ST.dimTo = 0; if (typeof crowdReset === 'function') crowdReset(); if (typeof cineSceneReset === 'function') cineSceneReset();
  const fog = S_ && S_.fog != null ? (typeof S_.fog === 'function' ? S_.fog() : S_.fog) : 0;
  ST.fog = ST.fogTo = fog; ST.fogWait = false;
  ST.dawn = ST.dawnTo = 0; ST.mist = ST.mistTo = 0; ST.zoom = ST.zoomTo = 1; ST.cam = null; ST.hw = null; ST.poseWait = false; ST.drops = []; ST.rings = []; ST.mistRects = null;
  ST.night = ST.nightTo = 0; ST.fire = null; ST.fireA = ST.fireTo = 0; ST.caption = null; if (!ST.darkWait) ST.dark = ST.darkTo = 0;   // Job 8g-r1
  if (!ST.lidKeep) { ST.lid = ST.lidTo = 0; ST.focus = ST.focusTo = 1; ST.lidWait = false; }   // a scripted arrival (wakeArrive) keeps the shut eyelid it came with
  if (S_ && S_.music !== undefined && !Script.active) playMusic(storyMusic(id));
}
// screen-space overlay drawn over the scene (white-out); drawn by drawWarpOverlay in 05c
// the evening dim eases every frame, also while a dialog box is open (update() in 08_main.js calls this before the dialog)
function dimTick() {
  if (ST.dim !== ST.dimTo) ST.dim = ST.dim < ST.dimTo ? Math.min(ST.dimTo, ST.dim + ST.dimV) : Math.max(ST.dimTo, ST.dim - ST.dimV);
  if (typeof sitUpdate === 'function') sitUpdate();   // Job 8g-r1: black fade, caption, night, fire (also while a dialog box is open)
}
function storyOverlay() {
  if (ST.focus < 0.995 && ST.lid < 0.999) blurScreen(1 - ST.focus);   // Job 9: waking, the world is out of focus, then sharpens
  drawLids();
  if (ST.dim > 0) { X.fillStyle = `rgba(14,10,28,${Math.min(0.8, ST.dim)})`; X.fillRect(0, 0, W * S, H * S); }
  if (ST.white > 0) { X.fillStyle = `rgba(252,250,244,${Math.min(1, ST.white)})`; X.fillRect(0, 0, W * S, H * S); }
  if (typeof sitOverlay === 'function') sitOverlay();   // Job 8g-r1: the black fade and its caption
}

// ---------------- fog overlay ----------------
// two layers of soft cloud texture drifting sideways at different speeds, heavier toward the top of the screen so the
// ground the hero walks on stays readable. amount 0..1. Drawn on the logical canvas L (or any 2D context in logical px).
let FOG_TEX = null;
function fogTex() {
  if (FOG_TEX) return FOG_TEX;
  const FW = W * 2, FH = H, R = mulberry(1021);
  const make = (n, rmin, rmax, a, seed) => {
    const [c, g] = mk(FW, FH); const r2 = mulberry(seed);
    for (let i = 0; i < n; i++) {
      const x = r2() * FW, y = Math.pow(r2(), 1.3) * FH, r = rmin + r2() * (rmax - rmin);
      for (const ox of [-FW, 0, FW]) { const gr = g.createRadialGradient(x + ox, y, 0, x + ox, y, r); gr.addColorStop(0, `rgba(236,240,246,${a})`); gr.addColorStop(1, 'rgba(236,240,246,0)'); g.fillStyle = gr; g.fillRect(x + ox - r, y - r, r * 2, r * 2); }
    }
    g.globalCompositeOperation = 'destination-in';
    const m = g.createLinearGradient(0, 0, 0, FH); m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(0.5, 'rgba(0,0,0,.85)'); m.addColorStop(0.75, 'rgba(0,0,0,.3)'); m.addColorStop(1, 'rgba(0,0,0,.15)');
    g.fillStyle = m; g.fillRect(0, 0, FW, FH); g.globalCompositeOperation = 'source-over';
    return c;
  };
  R();
  return (FOG_TEX = [make(70, 40, 110, 0.32, 77), make(46, 30, 80, 0.3, 91)]);
}
function drawFog(ctx, amount) {
  if (!(amount > 0.005)) return;
  const [a, b] = fogTex(), FW = W * 2;
  const o1 = (frame * 0.12) % FW, o2 = (frame * 0.27) % FW;
  ctx.save(); ctx.imageSmoothingEnabled = true;
  const veil = ctx.createLinearGradient(0, 0, 0, H); veil.addColorStop(0, 'rgba(232,237,243,.75)'); veil.addColorStop(0.4, 'rgba(232,237,243,.5)'); veil.addColorStop(0.7, 'rgba(232,237,243,.12)'); veil.addColorStop(1, 'rgba(232,237,243,.04)');
  ctx.globalAlpha = Math.min(1, amount); ctx.fillStyle = veil; ctx.fillRect(0, 0, W, H);   // a soft veil, heavy far away, thin over the near ground
  ctx.globalAlpha = Math.min(1, amount); ctx.drawImage(a, -o1, 0); ctx.drawImage(a, FW - o1, 0);
  ctx.globalAlpha = Math.min(1, amount) * 0.9; ctx.drawImage(b, -FW + o2, 0); ctx.drawImage(b, o2, 0);
  ctx.restore();
}

// ---- eased story state and the scripted hero walk (every frame, from storyUpdate) ----
// eyelid, focus, mist, dawn grade and zoom ease toward their targets; the hero's scripted walk ({ heroWalk }) runs in a straight line.
// The game's own per-frame story state (GAME_HOOKS.storyTick: 'pre' before the walk, 'post' after it) ticks inside this (e.g. the hero's pose in the mud).
function storyEase() {
  const ease = k => { const to = k + 'To', v = k + 'V'; if (ST[k] !== ST[to]) ST[k] = ST[k] < ST[to] ? Math.min(ST[to], ST[k] + ST[v]) : Math.max(ST[to], ST[k] - ST[v]); };
  ease('focus'); ease('mist'); ease('dawn'); ease('lid'); ease('zoom');
  if (ST.lidWait && ST.lid === ST.lidTo) { ST.lidWait = false; nextStep(); }
  const h = SC.hero;
  gameHook('storyTick', 'pre');
  if (ST.hw && h) {   // a scripted walk in a straight line
    const w = ST.hw, dx = w.x - h.x, dy = w.y - h.y, d = Math.hypot(dx, dy);
    if (d <= w.sp) { h.x = w.x; h.y = w.y; ST.hw = null; if (w.wait) nextStep(); }
    else { h.x += dx / d * w.sp; h.y += dy / d * w.sp; h.step += 1; h.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : (dy < 0 ? 1 : 0); if (frame % 22 === 0) sfx('step'); }
  }
  gameHook('storyTick', 'post');
}
// ---- eyelid and blur overlays (screen space, drawn by storyOverlay) ----
const BLUR_CH = [];
function blurScreen(amt) {
  const w = W * S, h = H * S, lv = clamp(Math.round(amt * 4), 1, 4);
  let src = X.canvas, sw = w, sh = h;
  for (let i = 1; i <= lv; i++) {   // halve a few times (a box filter), then stretch back up smoothed: a cheap blur that works in every browser
    const tw = Math.max(8, w >> i), th = Math.max(8, h >> i), c = BLUR_CH[i] || (BLUR_CH[i] = mk(tw, th)), g = c[1];
    g.imageSmoothingEnabled = true; g.clearRect(0, 0, tw, th); g.drawImage(src, 0, 0, sw, sh, 0, 0, tw, th); src = c[0]; sw = tw; sh = th;
  }
  X.imageSmoothingEnabled = true; X.globalAlpha = Math.min(1, 0.3 + amt * 1.1); X.drawImage(src, 0, 0, sw, sh, 0, 0, w, h); X.globalAlpha = 1; X.imageSmoothingEnabled = false;
}
// two lids that part into an almond-shaped opening: lid 1 = shut (black), 0 = open (nothing drawn)
function drawLids() {
  const raw = 1 - ST.lid; if (raw >= 0.999) return;
  const w = W * S, h = H * S;
  if (raw <= 0.002) { X.fillStyle = '#050304'; X.fillRect(0, 0, w, h); return; }
  const e = raw * raw * (3 - 2 * raw), o = e * 2.1, N = 48, hh = x => o * (h / 2) * (1 - 0.5 * Math.pow(2 * x / w - 1, 2));
  for (const sgn of [-1, 1]) {
    X.beginPath(); X.moveTo(0, sgn < 0 ? 0 : h); X.lineTo(w, sgn < 0 ? 0 : h);
    for (let i = N; i >= 0; i--) { const x = w * i / N; X.lineTo(x, h / 2 + sgn * hh(x)); }
    X.closePath(); X.fillStyle = '#050304'; X.fill();
    X.lineJoin = 'round'; X.strokeStyle = 'rgba(5,3,4,.35)'; X.lineWidth = 7 * S / 2; X.stroke();   // a soft lash line along the edge
  }
}

// ---- low mist over the water (world space, drawn by drawScene; layer 0 behind the actors, 1 a thin veil in front) ----
let MIST_PUFF = null;
function mistPuff() {
  if (MIST_PUFF) return MIST_PUFF;
  const [c, g] = mk(128, 128), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(236,234,248,.9)'); gr.addColorStop(0.5, 'rgba(236,234,248,.42)'); gr.addColorStop(1, 'rgba(236,234,248,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return (MIST_PUFF = c);
}
function drawMist(layer) {
  if (!(ST.mist > 0.01) || !ST.mistRects) return;
  const k = SC.k, pf = mistPuff(), t = frame;
  ST.mistRects.forEach((r, ri) => {
    const x0 = r[0] * k, y0 = r[1] * k, w = (r[2] - r[0]) * k, h = (r[3] - r[1]) * k, n = clamp(Math.round(w * h / 1700), 8, 60);
    for (let i = 0; i < n; i++) {
      const q = mulberry(i * 977 + ri * 131 + 7), a = q(), b = q(), c = q(), d = q();
      if ((i & 1) !== layer) continue;
      const pw = 90 + c * 120, sp = 0.05 + d * 0.1, span = w + pw, x = x0 - pw / 2 + ((a * span + t * sp) % span), y = y0 + b * h + Math.sin(t / 95 + i) * 2.5;
      const edge = Math.min(1, (x - x0 + pw / 2) / (pw * 0.8), (x0 + w + pw / 2 - x) / (pw * 0.8)), al = ST.mist * (layer ? 0.42 : 0.85) * clamp(edge, 0, 1) * (0.7 + 0.3 * Math.sin(t / 130 + i * 2));
      L.globalAlpha = al; L.drawImage(pf, x - pw / 2, y - pw * 0.17, pw, pw * 0.34);
    }
  });
  L.globalAlpha = 1;
}

// ============================================================
//  Chapter 1 engine additions (Job 8e, 10 Oct 2026): field foes, story examine spots with sparkles,
//  step-on triggers, scene-entry events, wandering NPCs, and the steps {refresh}, {dance}, {world}.
//  Chapter 1's data lives in 05f_chapter1.js.
// ============================================================
// storyDef(id).foes: [{ kind (ENEMIES id), x, y (painting px), r (wander radius, painting px), party (ids or fn), when }]
//   foe hooks (Job 12b; the pressure system's patrols, 05_pressure.js): peaceful() (looks straight through the hero), callout(f) -> steps
//   said before the fight, passBy(f) -> steps or null (said as he passes calmly), onWin() -> steps after a won fight
// They respawn each time the scene is entered; a beaten foe is gone for that visit, a fled one is dazed for a moment.
function storyFoes(id) {
  const S_ = storyDef(id), k = SC.k; if (!S_ || !S_.foes || !storyOn()) return [];
  const list = typeof S_.foes === 'function' ? S_.foes() : S_.foes;
  return list.filter(f => !f.when || f.when()).map((f, i) => ({ def: f, kind: f.kind, x: f.x * k, y: f.y * k, hx: f.x * k, hy: f.y * k, rad: (f.r || 160) * k,
    dir: 0, moving: false, step: 0, timer: 20 + i * 23, stun: 0, gone: false, tx: null, ty: null }));
}
// a mover's feet fit on walkable ground (foes and wandering NPCs; looser than the hero's probes)
const scMoverOk = (x, y) => scWalk(x - 3, y) && scWalk(x + 3, y) && scWalk(x, y - 2) && scWalk(x, y + 1);
function moverStep(o, tx, ty, sp) {
  const dx = tx - o.x, dy = ty - o.y, d = Math.hypot(dx, dy);
  if (d < 0.5) { o.moving = false; return false; }
  const s = Math.min(sp, d), nx = o.x + dx / d * s, ny = o.y + dy / d * s;
  o.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : (dy < 0 ? 1 : 0);
  if (scMoverOk(nx, ny)) { o.x = nx; o.y = ny; o.moving = true; o.step++; return true; }
  // slide along an edge only if that axis actually moves (a target straight across a wall used to 'slide' by zero and walk in place forever)
  if (Math.abs(nx - o.x) > 0.05 && scMoverOk(nx, o.y)) { o.x = nx; o.dir = dx < 0 ? 2 : 3; o.moving = true; o.step++; return true; }   // and face the way they slide, not the wall
  if (Math.abs(ny - o.y) > 0.05 && scMoverOk(o.x, ny)) { o.y = ny; o.dir = dy < 0 ? 1 : 0; o.moving = true; o.step++; return true; }
  o.moving = false; return false;
}
function foesUpdate() {
  if (!SC.foes || !SC.foes.length) return;
  const h = SC.hero, f_ = scHK(), live = G.state === 'scene' && !Script.active && !SC.warp && !G.fadeDir && !G.card;
  for (const f of SC.foes) {
    if (f.gone) continue;
    if (f.stun > 0) f.stun--;
    if (!live) { f.moving = false; continue; }
    const dh = Math.hypot(h.x - f.x, h.y - f.y), far = Math.hypot(f.x - f.hx, f.y - f.hy);
    const calm = f.def.peaceful && f.def.peaceful();   // Job 12b: a patrol that looks straight through the disguised hero (05_pressure.js)
    if (calm) { const say = dh < 28 * f_ && f.def.passBy && f.def.passBy(f); if (say) { run(say); return; } }   // what it says once as he passes
    else {
      if (dh < 9 * f_ && f.stun <= 0 && G.safe <= 0) { foeEncounter(f); return; }
      if (dh < 70 * f_ && f.stun <= 0 && far < f.rad * 1.8 && G.safe <= 0) { if (!moverStep(f, h.x, h.y, 0.95 * f_)) f.tx = null; continue; }
    }
    if (f.tx == null || --f.timer <= 0) {
      f.timer = ri(50, 140);
      if (Math.random() < 0.4) { f.tx = null; f.moving = false; continue; }
      const a = Math.random() * Math.PI * 2, r = Math.random() * f.rad; f.tx = f.hx + Math.cos(a) * r; f.ty = f.hy + Math.sin(a) * r * 0.7;
    }
    if (f.tx != null && !moverStep(f, f.tx, f.ty, 0.45 * f_)) f.tx = null;
  }
}
function foeEncounter(f) {
  if (typeof fsFoeHook === 'function' && fsFoeHook(f)) return;   // Job 12c: a companion calms the first stray dog
  if (!f.def.callout) { sfx('encounter'); G.flash = 24; }   // a patrol talks first and flashes only when the fight begins (Job 12b)
  SC.hero.moving = false;
  const p = f.def.party, ids = p ? (typeof p === 'function' ? p() : p) : (contentGet('parties', f.kind) ? contentGet('parties', f.kind)() : [f.kind]);
  const iw = SC.img.width / SC.ww, c = SC.cam, opts = { paintImg: SC.img, crop: [Math.max(0, c.x) * iw, Math.max(0, c.y) * iw, Math.min(W, SC.ww) * iw, Math.min(H, SC.wh) * iw], sceneFoe: f };
  if (f.def.callout) { run([...f.def.callout(f), () => { sfx('encounter'); G.flash = 24; }, { battle: ids, ...opts, win: f.def.onWin ? f.def.onWin() : [] }]); return; }   // Job 12b: a patrol calls him out first (05k)
  startBattle(ids, opts);
}
// [sprite, empty px under the feet, draw scale] for a foe
function foeSprite(f) {
  const fa = typeof fsArtDogSprite === 'function' && fsArtDogSprite(f); if (fa) return [fa, 0, 1];
  const d = contentGet('enemies', f.kind), fr = f.moving ? [1, 0, 3, 0][Math.floor(f.step / 7) % 4] : 0;
  const fc = (contentGet('enemies', f.kind) || {}).fieldCast, c = fc && castSprite(fc, f.dir, fr); if (c) return [c, 0, 1];
  if (d.kind) return [creatureSprite(d.kind, (d.kind === 'crow' || d.kind === 'bat') ? Math.floor(frame / 8) % 2 : (f.moving ? Math.floor(f.step / 8) % 2 : 0), f.dir === 3), 0, 1.6];
  return [charSprite(d.char, f.dir, fr, 0, SC_HERO_K * 1.2), 6, 1];
}

// storyDef(id).spots: [{ id, r: [x0, y0, x1, y1], at: [x, y] (sparkle point), sparkle, when, talk: () => steps }]: examine spots that the story
// adds or changes (pickups, prayers, a notice that changes). They are checked before the scene's own things.
function storySpot(px, py) {
  const S_ = storyDef(SC.id); if (!storyOn() || !S_ || !S_.spots) return null;
  return S_.spots.find(s => (!s.when || s.when()) && scIn(s.r, px, py)) || null;
}
// once-only pickups: a spot with `once` sets G.f['got_' + id] when examined and then disappears
function spotTalk(sp) { if (sp.once) G.f['got_' + sp.id] = 1; G.talkSpr = null; run(sp.talk() || []); }
const spotLive = sp => (!sp.when || sp.when()) && !(sp.once && G.f['got_' + sp.id]);

// draws foes and sparkles into the depth-sorted actor list of drawScene (05c)
function storyActs(acts, hk) {
  if (typeof fsArtActs === 'function') fsArtActs(acts, hk);
  for (const f of SC.foes || []) if (!f.gone) acts.push({ y: f.y, f: () => {
    if (f.stun > 0 && Math.floor(frame / 4) % 2) return;
    const fa = f.alpha == null ? 1 : f.alpha; if (fa <= 0) return;   // Job 12c: a foe fading away (fsVanish)
    const [s, pad, sc] = foeSprite(f), d = contentGet('enemies', f.kind), fly = d.kind === 'crow' || d.kind === 'bat';
    const w = s.width / (2 * (s.q || 1)) * hk * sc, hgt = s.height / (2 * (s.q || 1)) * hk * sc, lift = fly ? 10 * hk + Math.sin(frame / 10 + f.hx) * 2 : 0;
    L.globalAlpha = 0.7 * fa; L.drawImage(shadowSprite(18, 6), f.x - 9 * hk, f.y - 3 * hk, 18 * hk, 6 * hk); L.globalAlpha = 1;
    popSprite(L, s, Math.round((f.x - w / 2) * 2) / 2, Math.round((f.y - hgt + pad / 2 * hk * sc + 1 - lift) * 2) / 2, w, hgt, fa);
  } });
  const S_ = storyDef(SC.id); if (!storyOn() || !S_ || !S_.spots) return;
  for (const sp of S_.spots) if (sp.draw && spotLive(sp)) acts.push({ y: sp.drawY * SC.k, f: () => sp.draw(SC.k) });   // Job 12b: a prop an examine spot puts into the scene (the notice paper on the west gate)
  for (const sp of S_.spots) if (sp.sparkle && spotLive(sp)) {
    const k = SC.k, at = sp.at || [(sp.r[0] + sp.r[2]) / 2, (sp.r[1] + sp.r[3]) / 2], x = at[0] * k, y = at[1] * k;
    acts.push({ y, f: () => {
      const t = frame / 14 + x, a = 0.55 + Math.sin(t) * 0.45, r = 2 + Math.sin(t) * 1.2;
      L.globalCompositeOperation = 'lighter'; L.globalAlpha = a; L.drawImage(glowSprite(7, '#fff2b0'), x - 7, y - 9);
      L.fillStyle = '#fffbe8'; L.fillRect(x - r, y - 2.5, r * 2, 1); L.fillRect(x - 0.5, y - 2 - r, 1, r * 2);
      L.globalAlpha = 1; L.globalCompositeOperation = 'source-over';
    } });
  }
}

// NPCs with `wander: r` (painting px) amble around their spot when no script runs
function npcWander() {
  if (!SC.npcs || Script.active || G.state !== 'scene' || SC.warp) return;
  const k = SC.k;
  for (const n of SC.npcs) {
    if (!n.def.wander || n.hidden || ST.walkers.some(w => w.n === n)) continue;
    if (n.hx == null) { n.hx = n.x; n.hy = n.y; n.wt = ri(60, 200); }
    if (n.wx != null) {
      const h = SC.hero, near = Math.hypot(h.x - n.x, h.y - n.y) < 16 * scHK();
      if (near || !moverStep(n, n.wx, n.wy, 0.35 * scHK()) || Math.hypot(n.wx - n.x, n.wy - n.y) < 0.6) { n.wx = null; n.moving = false; n.wt = ri(90, 260); }
      continue;
    }
    if (--n.wt > 0) continue;
    const a = Math.random() * Math.PI * 2, r = Math.random() * n.def.wander * k; n.wx = n.hx + Math.cos(a) * r; n.wy = n.hy + Math.sin(a) * r * 0.6;
  }
}

// step-on triggers (storyDef(id).triggers: [{ r, flag, when, run }]) and scene-entry events (storyDef(id).events: [{ flag, when, run }]),
// each fires once per flag when the scene is idle. Called from storyIdle.
function storyTriggers(S_) {
  for (const e of S_.events || []) if (!G.f[e.flag] && (!e.when || e.when())) { G.f[e.flag] = 1; run(e.run()); return true; }
  const h = SC.hero;
  for (const t of S_.triggers || []) if (!G.f[t.flag] && (!t.when || t.when()) && scIn(t.r, h.x, h.y)) { G.f[t.flag] = 1; h.moving = false; run(t.run()); return true; }
  return false;
}
