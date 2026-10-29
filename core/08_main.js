// ============================================================
//  Title, game over, main loop
// ============================================================
// Job fw-F3c: the map of Japan moved into the travel system (src/05_travel.js: openWorld, worldUpdate, drawWorld, drawWorldUI); its
// places are LOCATIONS (03_data.js), its look WORLD_ATLAS (02e_scenes.js), the road to Kyoto ROAD_KYOTO (05n_road.js).

// ---------------- Title ----------------
// Title settings are separate from journey data. A newer saved journey wins over
// older title preferences; changing title settings never overwrites its progress.
const Title = { sel: 0, hasSave: false, save: null, diff: null, settings: false, override: false, age: 0 };
// The title's light for a save (null = no save) is the game's, read through a hook with its own predicates (job fw-F4): { key, dawn (0..1 the dawn grade), mist (0..1), child (true: the companion figure, game.json titleArt.child, stands
// beside the hero) }. A game without the hook gets plain daylight.
const TITLE_TIER_DAY = { key: 'day', dawn: 0, mist: 0, child: false };
const titleTier = save => gameHook('titleTier', save) || TITLE_TIER_DAY;
const titleOptions = () => Title.hasSave ? ['Continue', 'New Journey', 'Settings'] : ['New Journey', 'Settings'];
const titleSettingsKey = () => SAVE_KEY + '_title_settings';
function titleConfig(c) {
  c = c || {};
  return { diff: DIFF_IDS.includes(c.diff) ? c.diff : 'standard', aid: AID_IDS.includes(c.aid) ? c.aid : 'standard',
    speed: SPEEDS.includes(c.speed) ? c.speed : 1, ctl: CONTROL_SCHEMES.includes(c.ctl) ? c.ctl : 'auto' };
}
function titleRefresh() {
  const d = readSave(); Title.save = d && d.hero ? d : null; Title.hasSave = !!Title.save;
  let pref = null; try { pref = JSON.parse(localStorage.getItem(titleSettingsKey())); } catch (_) {}
  Title.override = !!(pref && pref.cfg && Number.isFinite(pref.t) && (!Title.save || pref.t > (Title.save.t || 0)));
  G.cfg = titleConfig(Title.override ? pref.cfg : Title.save && Title.save.cfg);
  Title.sel = 0; Title.settings = false; Title.diff = null; Title.age = 0;
  Title.tier = titleTier(Title.save); window.TITLE_TIER = Title.tier.key;
}
function titleRememberSettings() {
  Title.override = true;
  try { localStorage.setItem(titleSettingsKey(), JSON.stringify({ cfg: titleConfig(cfg()), t: Date.now() })); } catch (_) {}
}
function titleSaveSummary(d) {
  if (!d) return '';
  d = migrateSave(d);
  const at = d.sys.travel && d.sys.travel.map && d.sys.travel.map.at;
  const scene = d.scene && SCENES[d.scene[0]], loc = locById(at || GAME.start.location);
  const pt = playTime(d), minutes = Math.floor((pt || 0) / 60), time = pt !== undefined ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` :
    Number.isFinite(d.t) ? `saved ${new Date(d.t).toISOString().slice(0, 10)}` : 'saved journey';
  return `${scene && scene.name || loc && loc.name || 'Journey saved'} · Lv ${d.hero.lv || 1} · ${time}`;
}
function titleUpdate() {
  Title.age++;
  const opts = titleOptions();
  if (Music.name !== GAME.music.title) playMusic(GAME.music.title);
  if (Title.settings) {
    if (btn('b') || btn('start')) { Title.settings = false; sfx('back'); return; }
    const before = JSON.stringify(cfg()); settingsUpdate();
    if (JSON.stringify(cfg()) !== before) titleRememberSettings();
    return;
  }
  if (Title.diff != null) {
    if (nav('up')) { Title.diff = (Title.diff + 2) % 3; sfx('cursor'); }
    if (nav('down')) { Title.diff = (Title.diff + 1) % 3; sfx('cursor'); }
    if (btn('b')) { Title.diff = null; sfx('back'); return; }
    if (btn('a')) {
      sfx('ok'); const id = DIFF_IDS[Title.diff], prior = titleConfig(cfg()); Title.diff = null;
      G.cfg = { ...prior, diff: id, aid: Title.override && id === prior.diff ? prior.aid : DIFF[id].aid };
      newGame();
    }
    return;
  }
  if (nav('up')) { Title.sel = (Title.sel + opts.length - 1) % opts.length; sfx('cursor'); }
  if (nav('down')) { Title.sel = (Title.sel + 1) % opts.length; sfx('cursor'); }
  if (btn('a')) {
    sfx('ok'); const o = opts[Title.sel];
    if (o === 'Settings') { Title.settings = true; Menu.sub = 0; return; }
    if (o === 'Continue') {
      const d = readSave(), selected = titleConfig(cfg()), override = Title.override;
      if (d && d.hero) { warp(() => { loadData(d); if (override) G.cfg = selected; }); return; }
      titleRefresh(); return;
    }
    Title.diff = DIFF_IDS.indexOf(cfg().diff);
  }
}
function newGame() {
  itemFXReset();
  G.f = {}; G.sys = {}; G.hero = newHero(); G.allies = {}; G.active = []; G.inv = {}; G.map = null;   // job fw-F3c: clearing G.sys puts the map cursor back at game.json start.location (05_travel.js)
  playMusic(GAME.music.title);
  G.state = 'intro';
  // Job 8b: the playable prologue in the painted scenes (05d_story.js); the old tile-map start is the fallback when the paintings are missing
  if (typeof window.TEST_START === 'function' && !gameHook('ownTestStart')) { warp(() => window.TEST_START()); return; }   // Job 8g-r4: a test page's own start (e.g. west_open_test.js)
  gameHook('newGame');   // Job fw-F2: the game's own opening (e.g. intro cards, then a prologue)
}
function drawTitleUI() {
  const t = Title.age, a = Math.min(1, t / 50);
  themeUI('titleLockup')(a);   // job fw-F4: the paper, seal, wordmark, title, subtitle and year in the theme's look (game.json title art and text)
  const opts = titleOptions();
  if (t > 40) {
    const summary = Title.hasSave ? titleSaveSummary(Title.save) : '';
    const hint = Input.touchMode ? `Tap ${keyName('a')}` : `${keyName('up')}${keyName('down')} Choose   ${keyName('a')} Confirm`;
    X.save(); X.globalAlpha = a; frontMenu(27, 337, 300, opts, Title.sel, summary, hint); X.restore();   // 01_core.js
  }
  if (Title.settings) {
    X.fillStyle = 'rgba(8,12,16,.5)'; X.fillRect(0, 0, W * S, H * S);
    win(100, 55, 440, 265); drawSettings(100, 55, 440, true);
    wrap(settingsFoot(), 400, 11).slice(0, 3).forEach((line, i) => txt(line, 120, 232 + i * 16, UI.ink, 11));
    txt(`${keyName('b')} Back`, 120, 300, UI.soft, 11);
  }
  if (Title.diff != null) drawDiffPick(Title.diff, t);
}

// ---------------- Game over ----------------
function gameoverUpdate() {
  G.goT = (G.goT || 0) + 1;
  if (G.goT > 60 && btn('a')) {
    const h = G.hero; partyRestore(); h.mon = Math.floor(h.mon / 2);
    Script.queue = []; Script.active = false; Dialog.active = false;
    warp(() => gameHook('gameOverWake'));   // Job fw-F2: where a beaten party wakes is the game's (e.g. a farmhouse)
  }
}
function drawGameover() {
  const a = Math.min(1, (G.goT || 0) / 60);
  X.fillStyle = '#0a0406'; X.fillRect(0, 0, W * S, H * S);
  X.globalAlpha = a;
  headTxt(Object.keys(G.allies || {}).length ? gameText(GAME.gameOver.partyTitle) : gameText(GAME.gameOver.title), 320, 138, UI.sealHi, 26, 'center', 800);
  headTxt(gameText(GAME.gameOver.subtitle), 320, 182, '#b8a68a', 13, 'center', 500);
  X.globalAlpha = 1;
}

// ---------------- Main loop ----------------
function update() {
  if (G.hero && G.state !== 'title') sysState('play').time += 1 / 60;   // play time (01c_save.js)
  chronTick();
  if (G.fadeDir) {
    G.fade += G.fadeDir * 0.1;
    if (G.fadeDir === 1 && G.fade >= 1) { G.fade = 1; const cb = G.fadeCb; G.fadeCb = null; G.fadeDir = -1; cb && cb(); }
    else if (G.fadeDir === -1 && G.fade <= 0) { G.fade = 0; G.fadeDir = 0; }
  }
  if (G.flash > 0) G.flash--;
  if (typeof roadTickTransition === 'function' && roadTickTransition()) return;
  if (typeof dimTick === 'function') dimTick();   // the rest-stop evening dim (05d_story.js)
  if (typeof sleepTick === 'function') sleepTick();   // Job 8g-r5: the sleep fade (05i_sleep.js)
  if (G.state === 'scene' && typeof crowdTick === 'function') crowdTick();   // the stampede keeps running under a dialog box (05j)
  if (typeof cineTick === 'function') cineTick();   // Job 13: bars, shots, inserts and echoes run under a dialog box too (05l)
  if (itemFXTick()) return;
  if (G.card) return cardUpdate();
  if (G.stamp) return stampUpdate();
  if (Dialog.active) { dialogUpdate(); if (G.state === 'field') updateNpcs(G.map); return; }
  const m = MODES[G.state]; if (m && m.update) m.update();   // Job fw-F2: modes are registered by their kits (01a_game.js)
}
function render() {
  uiFrameStart();
  // Job fw-F2: draw through the mode registry (01a_game.js). An overlay mode (menu, shop) draws on top of the mode it opened from.
  const top = MODES[G.state], st = top && top.base ? top.base() : G.state, m = MODES[st];
  if (m && m.art) m.art(); else { L.fillStyle = '#000'; L.fillRect(0, 0, W, H); }
  X.imageSmoothingEnabled = false;
  X.drawImage(lo, 0, 0, W * S, H * S);
  if (m && m.grade) m.grade();
  if (m && m.ui) m.ui();
  if (top && top.overlay) top.overlay();
  if (typeof drawSleep === 'function') drawSleep();   // Job 8g-r5: the dark of a night's sleep, under the dialog box
  if (typeof drawMeetHud === 'function') drawMeetHud();   // Job 12a: the crowd's nerve at the town meeting
  if (typeof drawFestHud === 'function') drawFestHud();   // Job 16c: the tea contest's tray (05r)
  if (Dialog.active && G.state === 'road') drawRoadDialog(); else drawDialog();
  drawStamp();
  drawCard();
  drawItemFX();
  drawChronNotice();
  if (G.flash > 0) { const k = G.flash / 24; X.fillStyle = '#000'; for (let y = 0; y < H; y += 24) X.fillRect(0, y * S, W * S, Math.round(24 * k) * S); X.globalCompositeOperation = 'lighter'; X.fillStyle = `rgba(255,255,255,${Math.max(0, k - 0.6)})`; X.fillRect(0, 0, W * S, H * S); X.globalCompositeOperation = 'source-over'; }
  if (G.fade > 0) { X.fillStyle = `rgba(0,0,0,${G.fade})`; X.fillRect(0, 0, W * S, H * S); }
  if (typeof drawRoadTransition === 'function') drawRoadTransition();
}
let last = 0, acc = 0;
function loop(ts) {
  if (window.TEST_CLOCK) return;   // Job tests-2: a test page does not run on the real clock, the test steps it (testStep below)
  if (!last) last = ts;
  acc += Math.min(100, ts - last); last = ts;
  let n = 0;
  while (acc >= 1000 / 60 && n < 4) { frame++; update(); inputEndFrame(); acc -= 1000 / 60; n++; }
  render();
  requestAnimationFrame(loop);
}
// Job tests-2 (21 Oct 2026): the TEST CLOCK. A test page sets window.TEST_CLOCK = true before the page loads (testlib.py does); the real-time
// loop above then does nothing, and the test advances the game itself: testStep(n, draw) runs update() + inputEndFrame() n times in a row
// (the same two calls as one real frame, so a test is a pure simulation, 10x to 50x faster than waiting on the 60 fps clock).
// draw: 0 = no rendering (default), 1 = render the last frame, 2 = render every frame. Errors are re-thrown on the page's error channel
// (like the real loop's) instead of aborting the step. window.testHook, if a test sets one, runs once per frame just before update() (a
// frame-exact stand-in for the setInterval key-pressers some tests used). Inactive unless TEST_CLOCK is set.
if (window.TEST_CLOCK) {
  window.testStep = function (n = 1, draw = 0) {
    for (let i = 0; i < n; i++) {
      try { frame++; if (window.testHook) window.testHook(); update(); inputEndFrame(); if (draw === 2) render(); } catch (e) { setTimeout(() => { throw e; }); }
    }
    if (draw === 1) { try { render(); } catch (e) { setTimeout(() => { throw e; }); } }
    return frame;
  };
  window.testRender = function () { render(); return frame; };
}
// paint the big outdoor map (ground, faces, buildings) once, up front, behind a short loading card
function prebake() { try { gameHook('prebake'); } catch (e) { console.warn('prebake', e); } }   // the game's own warm-up (e.g. a tile map's ground and buildings)
// the title screen's painting (and the intro cards' backdrop): the game's (GAME_HOOKS.titleArt draws it and returns true), else game.json titleArt:
// { background: image name, crop?: [sx, sy, sw, sh], wash?: a CSS colour laid over it }; else the theme's paper
function drawTitleArt(g, t) {
  if (gameHook('titleArt', g, t) === true) return;
  const art = GAME.titleArt || {}, im = art.background && assetImg(art.background);
  g.fillStyle = UI.paper; g.fillRect(0, 0, W, H);
  if (im) { g.imageSmoothingEnabled = true; if (art.crop) g.drawImage(im, art.crop[0], art.crop[1], art.crop[2], art.crop[3], 0, 0, W, H); else g.drawImage(im, 0, 0, W, H); g.imageSmoothingEnabled = false; }
  if (art.wash) { g.fillStyle = art.wash; g.fillRect(0, 0, W, H); }
}
function boot(data) {
  themeUI('loading')(GAME.seal.join(''), GAME.loadingText);   // job fw-F4: the loading screen in the theme's look
  loadAssets().then(() => setTimeout(() => { if (!window.SCENE_TEST && !window.MINI_TEST && !gameHook('skipPrebake')) prebake(); boot2(data); }, 40));
}
function boot2(data) {
  window.TEST_READY = true;   // Job tests-2: every image has loaded (or failed: window.ASSET_FAIL lists them) and the title is about to run
  titleRefresh();
  if (gameHook('boot', data)) { requestAnimationFrame(loop); return; }   // the game's own test pages and starts (e.g. its dance and boss test pages)
  if (window.MINI_TEST) { miniTestBoot(window.MINI_TEST); requestAnimationFrame(loop); return; }   // Job 16a minigame test page (make_mini_page.py)
  if (window.SCENE_TEST) { const t = GAME.sceneTest || {}; G.f = Object.assign({}, t.flags); G.hero = newHero(); G.inv = Object.assign({}, t.inv); enterScene(window.SCENE_TEST); requestAnimationFrame(loop); return; }   // game.json sceneTest: the flags and items a scene test page starts with
  if (data && data.hero) { try { loadData(data); } catch (e) { G.state = 'title'; } }
  requestAnimationFrame(loop);
}
try { window.claude && window.claude.hot && window.claude.hot.snapshot && window.claude.hot.snapshot(() => (G.hero && G.state !== 'title' && G.state !== 'intro' && G.state !== 'battle' ? saveData() : null)); } catch (e) {}
// Job tests-5: a test page waits for every web-font piece the game's text can use (each face, the characters in its scripts): text is never
// drawn or measured (wrap) in a fallback font that a piece arriving later, in real time, would replace. A warm worker tab has them cached.
function testFonts() {
  if (!document.fonts) return Promise.resolve();
  const sources = [...document.scripts].map(s => s.src ? fetch(s.src).then(r => r.text()).catch(() => '') : Promise.resolve(s.text));   // linked pages load the game from a file
  return Promise.all(sources).then(texts => {
    const chars = [...new Set(texts.join(''))].filter(c => c >= ' ').join('');
    const faces = [...new Set([...document.fonts].map(f => f.weight + ' 30px "' + f.family.replace(/"/g, '') + '"'))];
    return Promise.race([Promise.all(faces.map(f => document.fonts.load(f, chars).catch(() => null))), new Promise(r => setTimeout(r, 15000))]);
  }).catch(() => {});
}
// the theme's faces (theme.json fonts.preload: [font, sample text]) before the first frame, at most 2.5 s
const fontReady = window.TEST_CLOCK ? testFonts() : Promise.race([document.fonts ? Promise.all((THEME.fonts.preload || []).map(([f, sample]) => document.fonts.load(f, sample))) : Promise.resolve(), new Promise(r => setTimeout(r, 2500))]).catch(() => {});
fontReady.then(() => {
  const hot = window.claude && window.claude.hot;
  if (hot && hot.ready) hot.ready(boot); else boot((hot && hot.data) || null);
});
// Job fw-F2: the core's own modes (the world map moves to the travel system in F3)
defineMode('title', { update: () => titleUpdate(), art: () => drawTitleArt(L, frame), ui: () => drawTitleUI() });
defineMode('intro', { art: () => drawTitleArt(L, frame) });
defineMode('gameover', { update: () => gameoverUpdate(), overlay: () => drawGameover() });
