// ============================================================
//  Game registries (job fw-F2, 28 Oct 2026; plan: the framework plan, "Target shape")
//  The engine core never names a game, a kit's mode or a game's content. Small tables connect them (1-3 here; story steps and
//  draw layers, 4-5, below):
//
//  1. MODES: what the main loop runs. A kit (or the game) registers each mode once, next to its own code:
//       defineMode('scene', { kit: 'topdown', update, art, grade, ui })
//     update() runs every frame while G.state is that mode. render() draws the mode's `art` on the low-res layer (black when it has
//     none), scales it up, then calls `grade` and `ui` on the screen layer. A mode with `base` (the pause menu, a shop) is an overlay:
//     render() draws the base mode's art and ui, then the overlay's `overlay`. Today's kits: topdown (field, scene, road),
//     battle-turn (battle), minigame (mini, dance); the core owns title, intro, world, menu, shop and gameover until F3 moves the world
//     map into the travel system. A future side-scroller or visual-novel kit registers its own modes the same way.
//  2. CONTENT: the game's data tables by kind (items, techniques, enemies, cast, locations, scenes...). The game registers them;
//     engine systems look them up with content(kind) / contentGet(kind, id) instead of naming a game's globals. F3 moves the
//     systems onto these lookups.
//  3. HOOKS: the few places where the engine hands over to the game's own story (what New Journey starts, where a beaten party
//     wakes, the menu's current objective). The game sets GAME_HOOKS.<name>; the engine calls gameHook(name, ...args) and falls
//     back to a neutral default when the game has none.
//  GAME itself (title, seal, save key, screen, fonts, hero name, currency...) comes from game.json, injected by build.py.
//  Job fw-F3b: the systems (items and shops, party, Chronicle, bonds and letters, pressure) read the game's tables only through
//  content(kind) / contentGet(kind, id) and its hooks; the kinds each system reads are listed in its file's header (05_items.js,
//  05_party.js, 05_chronicle.js, 05_bonds.js, 05_pressure.js). Menu pages and card pages have tables of their own (6 and 7, below).
// ============================================================
const MODES = {};
function defineMode(id, def) { MODES[id] = Object.assign({ id }, def); return MODES[id]; }

const CONTENT = {};
// A table may be registered as a function returning it, so a game can register tables defined in files that load later.
function registerContent(kind, table) { CONTENT[kind] = table; return table; }
const content = kind => { const t = CONTENT[kind]; return (typeof t === 'function' ? t() : t) || {}; };
const contentGet = (kind, id) => content(kind)[id];

const GAME_HOOKS = {};
function gameHook(name, ...args) { const f = GAME_HOOKS[name]; return typeof f === 'function' ? f(...args) : undefined; }

// ============================================================
//  Story steps and scene draw layers (job fw-F3a, 28 Oct 2026; plan: "Extraction jobs", F3)
//  Every registration names its OWNER: 'core', 'kit:<kit>' (e.g. 'kit:topdown'), 'system:<system>' (e.g. 'system:party') or 'game'.
//  Engine files register core, kit and system entries; the game registers its own from its content files (registry_test.py checks
//  which file registers what). ORDER is behaviour: entries run in ascending `order`, so a game step can sit between two engine steps
//  exactly where it always ran. Orders are unique within a table (the test checks that too).
//
//  4. STORY_STEPS: the script-step grammar. nextStep (05_field.js) hands every object step to storyStep(s), which asks the table in order:
//       defineStep('fog', { owner: 'kit:topdown', order: 1020, when: s => s.fog != null, run: s => { ...; return 'next'; } })
//     A step WITH `when` claims the step when when(s) is true, and storyStep returns run(s) as it is. A HANDLER (no `when`) is asked
//     with run(s) and passes the step on by returning nothing (the cinema layer, the stampede, field skills and the festival, orders
//     100-500, are asked before every plain step). run returns 'wait' (the step calls nextStep itself later), 'next' (done at once),
//     or undefined (not a story step: nextStep carries on with its own grammar).
//  5. LAYERS: named slots a mode's renderer offers, filled by kits, systems and the game. A slot is a list of { id, owner, order, fn }:
//       defineLayer('backdrop', 'water', { owner: 'kit:topdown', order: 200, fn: (cx, cy, ix) => drawWaterLoops(cx, cy, ix) })
//     drawLayers(slot, ...args) calls every fn in order; firstLayer(slot, ...args) returns the first truthy result; layerList(slot) gives
//     the entries to a renderer that folds them itself (a grade, a camera offset). The painted scene's slots are listed in 05c_scene.js
//     (SCENE_SLOTS, above drawScene).
// ============================================================
const STORY_STEPS = [];
const byOrder = (a, b) => a.order - b.order;
function defineStep(id, def) {
  const d = Object.assign({ id, owner: 'core', order: 0 }, def), i = STORY_STEPS.findIndex(x => x.id === id);
  if (i >= 0) STORY_STEPS.splice(i, 1);
  STORY_STEPS.push(d); STORY_STEPS.sort(byOrder); return d;
}
function storyStep(s) {
  for (const d of STORY_STEPS) {
    if (d.when) { if (d.when(s)) return d.run(s); }
    else { const r = d.run(s); if (r) return r; }
  }
  return undefined;
}

const LAYERS = {};
function defineLayer(slot, id, def) {
  const list = LAYERS[slot] || (LAYERS[slot] = []), d = Object.assign({ id, slot, owner: 'core', order: 0 }, def), i = list.findIndex(x => x.id === id);
  if (i >= 0) list.splice(i, 1);
  list.push(d); list.sort(byOrder); return d;
}
const layerList = slot => LAYERS[slot] || [];
function drawLayers(slot, ...args) { for (const d of layerList(slot)) d.fn(...args); }
function firstLayer(slot, ...args) { for (const d of layerList(slot)) { const r = d.fn(...args); if (r) return r; } return null; }

// Small text helpers for game.json strings: '{hero}' is replaced by the hero's name.
const gameText = (s, vars = {}) => String(s || '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : k === 'hero' ? GAME.hero.name : m));

// ============================================================
//  Menu pages and card pages (job fw-F3b, 28 Oct 2026; plan: "Extraction jobs", F3)
//  6. MENU_PAGES: the pause menu's pages. The GAME chooses its pages and their order; the engine and its systems only offer them.
//     Each system puts its stock pages in MENU_STOCK next to its code (MENU_STOCK.items in 05_items.js, .party in 05_party.js, ...),
//     and the game registers the ones it wants from its own content files:
//       defineMenuPage('items', { stock: 'items', order: 100 })          a stock page, as the system made it (fields given here win)
//       defineMenuPage('ledger', { label: 'Ledger', order: 155, list: () => [...], row: e => ({ name: e.name }) })   its own page
//     A stock page is looked up when the menu asks for it, so a game may register it before the engine file that makes it has loaded.
//     A game that does not register a page simply has no such page (dropMenuPage(id) takes one out again). The menu (06_menu.js) shows
//     the registered pages whose when() holds, in ascending `order`, as the left-hand column. A page is either
//       a LIST page:   list(m) -> entries, row(it, m) -> { name, right, icon?, thumb?(x, y), fit? }, use(it, m) on A, info(it, m) -> the
//                      footer text for the entry under the cursor, title(m), head() -> small text at the panel's top right, right(it, m)
//                      on Right (Party: talk), turn(dir) on Left / Right (Chronicle tabs), members: Left / Right pick the party member;
//       or a CUSTOM page: draw(px, py, pw, ph, m) its own panel, input() its own update (B always closes it), foot(m) -> [text, colour].
//     pick() runs when the page is chosen in the left column and returns false to stay there (Save, Close, a refusal).
//     `home: true` marks the page whose panel shows while no page is open (e.g. Status). m = the party member the menu is showing.
//  7. CARD_PAGES: object pages of G.card by kind (05_field.js cardUpdate / drawCard). A plain string page is drawn by the core as before.
//       defineCardPage('letter', { draw: (o, a, c) => ..., pages: o => n, shown: o => ..., card: c => ... })
//     draw draws one page on the washi sheet (a = fade-in alpha, c.sub = the page's own sub-page); pages(o) = how many sub-pages it turns
//     through before the card moves on; shown(o) runs when it is first shown; card(c), when given, draws the whole card itself (the
//     Chronicle's scroll) instead of the washi sheet.
// ============================================================
const MENU_STOCK = {};
const MENU_PAGES = {};
function defineMenuPage(id, def) { MENU_PAGES[id] = Object.assign({ order: 0 }, def, { id }); return MENU_PAGES[id]; }
function dropMenuPage(id) { delete MENU_PAGES[id]; }
// a registered page with its stock page filled in (null if the game has no such page)
const menuPage = id => { const d = MENU_PAGES[id]; return d ? Object.assign({ label: id }, d.stock ? MENU_STOCK[d.stock] : null, d) : null; };
const menuPageList = () => Object.keys(MENU_PAGES).map(menuPage).sort(byOrder);   // every registered page, shown or not
const menuPages = () => menuPageList().filter(p => !p.when || p.when());           // the pages the menu shows now, in order

const CARD_PAGES = {};
function defineCardPage(kind, def) { CARD_PAGES[kind] = Object.assign({ kind }, def); return CARD_PAGES[kind]; }
const cardPageKind = o => (o && typeof o === 'object' && CARD_PAGES[o.kind]) || null;

// ============================================================
//  8. THEME: the game's look (job fw-F4, 29 Oct 2026; plan: the framework plan, "Target shape", themes/)
//  game.json names the theme ("theme": "ink-washi"); it lives in themes/<id>/:
//    theme.json   the TOKENS, injected by build.py as THEME_DEF: colors (UI.ink, UI.seal... in the engine), fonts (FONT, FONT_HEAD, the
//                 stylesheets the page loads, the faces the boot waits for), sizes (dialogue text)
//    *.js         the theme's CODE, put in by build.py right after the core files (src/01*.js): it registers one drawer per widget
//                 and per battle effect, and keeps its own helpers (brush strokes, a washi fill and paper panels are there and nowhere else)
//    art/         the theme's ART (images), loaded as theme_<name>: themeArt(name)
//  The engine (core, kits, systems) and the game's content draw a panel, a mark, a page or a band only through the core wrappers that ask
//  the theme (win, selBar, txt, uiMark, cursor, moreMark, uiBubble, uiBanner, gauge, uiStroke, uiPage, uiStamp, uiArtWash, ...) and a battle
//  effect only through themeFx (07d_battle_fx.js). tests/theme_test.py builds the game with the plain test theme (themes/plain/), renders
//  every screen with it and checks that nothing outside themes/ draws the ink-washi look by itself.
//    defineThemeUI(name, fn)     a widget; every name in THEME_WIDGETS must be registered by every theme (the arguments are listed there)
//    defineThemeFx(type, fn)     a battle effect drawer fn(g, f, k) for B.fx entries of that type (07d_battle_fx.js); `raw: true` (third
//                                argument { raw: true }) = drawn every frame as fn(g, f, impact), the impact frame included, with f.t unscaled
//    THEME_FX.default            draws an effect type the theme has no drawer for (a theme may draw every effect with it)
// ============================================================
const THEME = THEME_DEF;
const THEME_UI = {}, THEME_FX = {}, THEME_FX_RAW = new Set();
const THEME_WIDGETS = {
  panel: '(x, y, w, h, style) a panel; style 1 = a speaker\'s name tab',
  selBar: '(x, y, w, h) under the chosen line of a list',
  text: '(col, panel, shadow) -> [colour, heading font?, shadow colour or null] for txt() on a panel (UI_PANELS entry) or on the screen (null)',
  mark: '(x, y, r, a) the accent mark: cursor, "more", small accents',
  bubble: '(x, y, glyph) a hint bubble over the hero',
  banner: '(text, cx, y, a, size) a band across the screen with a title',
  gauge: '(x, y, w, v, max, col, h) a bar (HP, Ki)',
  stroke: '(g, ax, ay, bx, by, wd, R, col, alpha, dry) a decorative stroke on canvas g, canvas px; R = a seeded random',
  page: '() -> a full-screen canvas (W*S x H*S): the sheet under cards, letters and the Chronicle',
  stamp: '(x, y, sz, glyph, rot) a small square stamp with one glyph',
  liberation: '(s, text) the chapter-end stamp over the dimmed screen; s = G.stamp ({ name, t }), text = game.json liberation',
  cutIn: '(c, n) a fighter\'s signature band; c = { t, name }, n = its length in frames',
  techTag: '(tg) a technique\'s name across the screen; tg = { t, name }',
  titleLockup: '(a) the title screen\'s lockup: its paper, seal, wordmark or title, subtitle and year (a = fade-in alpha)',
  artWash: '(img, sx, sy, sw, sh, cw, ch, seed) -> a cw x ch canvas: the crop (sx, sy, sw, sh) of painting img as the theme\'s illustration (letters, date cards)',
  enso: '(g, o, r, i, n, R) arc i of n of the circle drawn under a keepsake with no picture (canvas g, centre (o, o), radius r, canvas px)',
  battleBackdrop: '(src) -> a canvas (W*D x H*D): the standoff\'s version of the battle backdrop src',
  battleImpact: '(g) the impact frame\'s background (logical px)',
  battleSil: '(s) -> a canvas: sprite s as the impact frame\'s silhouette',
  battleWipe: '(g, k) the wipe into a fight, k from 0 (covered) to 1 (open)',
  standoffWind: '(g, t) the standoff\'s wind lines at frame t',
  loading: '(glyphs, text) the loading screen before the images are in',
  scrollRails: '(top, bottom) the rails the Chronicle\'s scroll unrolls between',
  scrollRods: '(x, y, w, hh) a keepsake scroll\'s rods, w wide, hh unrolled',
  rhythmNote: '(key, x, y, r, a) a note on the rhythm lane: key \'a\' = the action button, or up / right / down / left; centre (x, y) and radius r in logical px, alpha a',
  rhythmRing: '(x, y, glow, res) the lane\'s hit ring at (x, y); glow 0..1 after a hit, res = \'great\' or \'good\'',
};
function defineThemeUI(name, fn) { THEME_UI[name] = fn; return fn; }
function themeUI(name) { const f = THEME_UI[name]; if (!f) throw new Error('theme ' + THEME.id + ' has no widget ' + name); return f; }
function defineThemeFx(type, fn, o) { THEME_FX[type] = fn; if (o && o.raw) THEME_FX_RAW.add(type); else THEME_FX_RAW.delete(type); return fn; }
const themeFx = type => THEME_FX[type] || THEME_FX.default;
const themeArt = name => assetImg('theme_' + name);

// ============================================================
//  9. TEST_JUMPS: the moments a tester can start straight into (job fw-F7, 30 Oct 2026: a tester's links straight to scenes are part of the
//     framework, not each game's own page). The game registers them from its own content files:
//       defineTestJump('envoys', { label: 'The envoys at the plough', group: 'Cutscenes', order: 40, flags: { met: 1 }, inv: { bread: 2 },
//                                  run: () => { enterScene('area_farm', [100, 200, 3]); run(envoyScript()); } })
//     testJump(id) starts a clean journey: a new hero, the definition's `flags` and `inv` (nothing else), empty system state, no script, dialog,
//     card or map, G.state = def.state (default 'scene'), then run(). A page opened with ?jump=<id> starts there once its images have loaded
//     (08_main.js boot2) and sets window.TEST_JUMP. The test page the build generates for a game (buildlib.build writes pub_<id>/tests.html;
//     the site builder hosts it at /games/<id>/test/ or, for the site's own game, /test/jumps/) shows one button per jump, grouped by `group`
//     in the order of `order`. A game that registers none gets no such page, and its pages only carry this registry.
// ============================================================
const TEST_JUMPS = Object.create(null);
function defineTestJump(id, def) { TEST_JUMPS[id] = Object.assign({ label: id, group: '', order: 0, state: 'scene' }, def, { id }); return TEST_JUMPS[id]; }
const testJumpList = () => Object.values(TEST_JUMPS).sort(byOrder);
function testJump(id) {
  const d = TEST_JUMPS[id]; if (!d) return false;
  itemFXReset();
  G.f = Object.assign({}, d.flags); G.sys = {}; G.hero = newHero(); G.allies = {}; G.active = []; G.inv = Object.assign({}, d.inv); G.map = null; G.card = null;
  Script.queue = []; Script.active = false; Dialog.active = false;
  G.state = d.state; d.run(); window.TEST_JUMP = id; return true;
}
