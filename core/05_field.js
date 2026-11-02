// ============================================================
//  Game state, field engine, dialog & scripting
// ============================================================
const DX = [0, 0, -1, 1], DY = [1, -1, 0, 0];
const G = {
  state: 'title', f: {}, hero: null, inv: {}, map: null, mapId: null, p: null,
  fade: 0, fadeDir: 0, fadeCb: null, banner: null, safe: 0, leaves: [],
  sys: {},   // saved system state by namespace (01c_save.js; jobs fw-F3c, fw-F3b): G.worldSel, G.lastLoc read the travel namespace (05_travel.js),
            // G.allies, G.active the party's (05_party.js)
};
// job fw-F3b: the hero's starting kit is the game's (game.json hero.start)
function newHero() { const k = GAME.hero.start; return { name: GAME.hero.name, lv: 1, xp: 0, hp: k.hp, ki: k.ki, mon: 0, weapon: k.weapon, armor: k.armor, weapons: [k.weapon], armors: [k.armor], techs: k.techs.slice(), bonus: { atk: 0, ki: 0 } }; }
// The save is version SAVE_VERSION with every system's state in `sys` (01c_save.js; jobs fw-F3c, fw-F3b).
function saveData() {
  const p = G.p || {};
  const keep = G.state === 'battle' && G.battleReturn === 'scene' && saveSpaces('battleScene').some(s => s.battleScene());   // a fight on the travel system's walking leg
  const sc = (G.state === 'scene' || (G.state === 'menu' && Menu.prev === 'scene') || keep) && SC.id && SC.hero ? (SC.padOn >= 0 && SC.def.padHome ? [SC.id, ...SC.def.padHome] : [SC.id, Math.round(SC.hero.x / SC.k), Math.round(SC.hero.y / SC.k), SC.hero.dir]) : null;   // Job 8d: saved on a secret pad, he wakes where the way in is
  return { v: SAVE_VERSION, f: G.f, sys: G.sys, hero: G.hero, inv: G.inv, mapId: G.state === 'world' ? null : G.mapId, x: p.x, y: p.y, dir: p.dir, scene: sc, cfg: G.cfg || null, t: Date.now() };
}
function loadData(raw) {
  itemFXReset();
  const d = migrateSave(raw);
  G.f = d.f || {}; G.sys = d.sys; G.hero = d.hero; G.inv = d.inv || {};
  if (!G.hero.bonus) G.hero.bonus = { atk: 0, ki: 0 };
  G.cfg = d.cfg || null;   // Job 11: difficulty and battle settings (null = Standard)
  for (const s of saveSpaces('loaded')) s.loaded(d);
  for (const s of saveSpaces('resume')) if (s.resume(d)) return;   // a journey between stops resumes on the road (05_travel.js)
  if (d.scene && SCENES[d.scene[0]] && assetImg(SCENES[d.scene[0]].img)) enterScene(d.scene[0], d.scene.slice(1));
  else if (d.mapId && contentGet('maps', d.mapId)) enterMap(d.mapId, d.x, d.y, d.dir || 0, true); else openWorld();
  for (const s of saveSpaces('placed')) s.placed(d);   // a walking leg picks up its pending beat (05_travel.js)
}

// ---------- inventory helpers used by scripts ----------
const has = id => (G.inv[id] || 0) > 0;
function give(id, n = 1) { G.inv[id] = (G.inv[id] || 0) + n; itemNotice(id, 'i', n); }
function take(id, n = 1) { const got = Math.min(G.inv[id] || 0, n); G.inv[id] = Math.max(0, (G.inv[id] || 0) - n); if (!G.inv[id]) delete G.inv[id]; if (got) itemTaken(id, got); }
function giveMon(n) { G.hero.mon += n; sfx('coin'); itemNotice(GAME.currency.id, 'i', n); }
function giveWeapon(id, equip) { const fresh = !G.hero.weapons.includes(id), before = heroStats(G.hero).atk; if (fresh) G.hero.weapons.push(id); if (equip) G.hero.weapon = id; sfx('item'); if (fresh) itemGear(id, 'w', before, heroStats(G.hero).atk); }
function giveArmor(id, equip) { const fresh = !G.hero.armors.includes(id), before = heroStats(G.hero).def; if (fresh) G.hero.armors.push(id); if (equip) G.hero.armor = id; sfx('item'); if (fresh) itemGear(id, 'a', before, heroStats(G.hero).def); }
function learn(id) { if (!G.hero.techs.includes(id)) { G.hero.techs.push(id); itemNotice(id, 'tech'); } }
function rest(cost, save) { G.hero.mon -= cost; if (typeof partyRestore === 'function') partyRestore(); else { const s = heroStats(G.hero); G.hero.hp = s.maxHp; G.hero.ki = s.maxKi; } sfx('heal'); if (save) writeSave(saveData()); }

// ============================================================
//  Map compile
// ============================================================
function compileMap(id) {
  const def = contentGet('maps', id)(G.f);
  const h = def.grid.length, w = def.grid[0].length;
  const ground = grid(w, h, '.'), prop = grid(w, h, null), solid = grid(w, h, false), pv = grid(w, h, 0);
  const floorCh = def.floor || '.';
  const stairs = grid(w, h, false), Hgt = def.height ? def.height.map(r => r.slice()) : grid(w, h, 0);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = def.grid[y][x];
    if (ch === '/' && def.height) { ground[y][x] = ':'; stairs[y][x] = true; }
    else if (GROUND[ch]) ground[y][x] = ch; else if (ch) { prop[y][x] = ch; ground[y][x] = null; }
  }
  // props take the ground of a walkable neighbour
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (ground[y][x] == null) {
    let g = null;
    for (const [dx, dy] of [[-1, 0], [0, -1], [1, 0], [0, 1]]) { const n = ground[y + dy] && ground[y + dy][x + dx]; if (n && !SOLID_GROUND.has(GROUND[n]) && n !== 'D') { g = n; break; } }
    ground[y][x] = g || PROP_GROUND[prop[y][x]] || floorCh;
  }
  const clearAt = (x, y) => { if (prop[y] && prop[y][x]) { prop[y][x] = null; } };
  const doors = {}, footprint = {};
  for (const b of def.blds) {
    for (let j = b.y; j < b.y + b.h; j++) for (let i = b.x; i < b.x + b.w; i++) { clearAt(i, j); footprint[i + ',' + j] = b; }
    if (b.door) doors[b.door[0] + ',' + b.door[1]] = b;
  }
  for (const o of [...def.npcs, ...def.chests, ...def.sparkles]) clearAt(o.x, o.y);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const gt = GROUND[ground[y][x]];
    let s = SOLID_GROUND.has(gt);
    const pr = prop[y][x];
    if (pr) { if (PROP_SOLID.has(pr)) s = true; pv[y][x] = pr === 'F' ? ((prop[y][x - 1] === 'F' ? 1 : 0) | (prop[y][x + 1] === 'F' ? 2 : 0)) : pr === 'J' && prop[y][x - 1] !== 'J' && prop[y][x + 1] !== 'J' ? 8 : Math.floor(hash(x, y, 4) * 4); }
    const b = footprint[x + ',' + y];
    if (b) {
      if (b.type === 'torii') s = (y === b.y + b.h - 1) && (x === b.x || x === b.x + b.w - 1);
      else if (b.door && b.door[0] === x && b.door[1] === y && b.to) s = false;
      else s = true;
    }
    solid[y][x] = s;
  }
  const m = {
    id, def, w, h, ground, prop, solid, pv, doors, footprint, H: Hgt, stairs, faceStyle: def.faceStyle || (() => 'earth'),
    maxH: Math.max(...Hgt.map(r => Math.max(...r))), minSY: Math.min(0, ...Hgt.map((r, y) => Math.min(...r.map(v => (y - v) * T)))),
    blds: def.blds, signs: def.signs || {}, zones: def.zones || [], exits: def.exits || [],
    chests: def.chests.filter(c => !G.f['chest_' + c.id]), sparkles: def.sparkles.filter(s => !G.f['spark_' + s.id]),
    dark: def.dark, outdoor: def.outdoor, name: def.name, music: def.music, back: def.back, special: def.special || {},
    npcs: [], enemies: [],
  };
  m.groundType = (x, y) => { if (x < 0 || y < 0 || x >= w || y >= h) return null; return GROUND[ground[y][x]]; };
  m.acc = { ground: (x, y) => m.groundType(x, y) };
  for (const n of def.npcs) if (!n.when || n.when()) m.npcs.push(Object.assign({}, n, { px: n.x * T, py: n.y * T, dir: n.dir || 0, hx: n.x, hy: n.y, moving: false, timer: ri(60, 200), step: 0 }));
  return m;
}
function spawnEnemies(m) {
  m.enemies = [];
  for (const z of m.zones) {
    for (let i = 0; i < z.n; i++) {
      for (let tries = 0; tries < 40; tries++) {
        const x = z.x + ri(0, z.w - 1), y = z.y + ri(0, z.h - 1);
        if (!walkable(m, x, y, null) || (G.p && Math.abs(x - G.p.x) + Math.abs(y - G.p.y) < 7)) continue;
        if (m.enemies.some(e => e.x === x && e.y === y)) continue;
        m.enemies.push({ kind: pick(z.kinds), x, y, px: x * T, py: y * T, dir: 0, moving: false, timer: ri(20, 90), stun: 0, zone: z, step: 0 });
        break;
      }
    }
  }
}
function stepCheck(m, x, y, d, self, mover) { // null = blocked; otherwise {climb, hop}
  const nx = x + DX[d], ny = y + DY[d];
  if (!walkable(m, nx, ny, self)) return null;
  const h1 = m.H[y][x], h2 = m.H[ny][nx];
  if (h1 === h2) return { climb: false, hop: false };
  if (!mover) return null; // NPCs and monsters keep to their own level
  if (d === 1 && m.stairs[y][x] && h2 > h1) return { climb: true };
  if (d === 0 && m.stairs[ny][nx] && h1 > h2) return { climb: true };
  if (d === 0 && h1 - h2 === 1) return { hop: true };
  return null;
}
function walkable(m, x, y, self) {
  if (x < 0 || y < 0 || x >= m.w || y >= m.h) return false;
  if (m.solid[y][x]) return false;
  for (const n of m.npcs) if (n !== self && ((n.x === x && n.y === y) || (n.moving && n.tx === x && n.ty === y))) return false;
  for (const c of m.chests) if (c.x === x && c.y === y) return false;
  return true;
}
function enterMap(id, x, y, dir = 0, silent) {
  const prevName = G.map && G.map.name;
  G.mapId = id; G.map = compileMap(id);
  G.p = { x, y, px: x * T, py: y * T, dir, moving: false, tx: x, ty: y, step: 0, h: G.map.H[y][x], arc: 0 };
  spawnEnemies(G.map);
  G.state = 'field';
  playMusic(G.map.music);
  if (!silent || prevName !== G.map.name) G.banner = { text: G.map.name, t: 150 };
  G.safe = 40;
  if (G.map.outdoor) G.lastLoc = GAME.start.location;   // the outdoor tile maps stand at the game's first place on the world map
}
function rebuildMap() {
  const p = G.p; const m = compileMap(G.mapId);
  // keep surviving enemies' positions sensible: just respawn
  G.map = m; spawnEnemies(m); playMusic(m.music);
  if (m.solid[p.y][p.x]) { p.y++; p.py = p.y * T; }
}
function warp(fn) { if (G.fadeDir) return; G.fadeDir = 1; G.fadeCb = fn; }

// ============================================================
//  Dialog, cards, script runner
// ============================================================
const Dialog = { active: false, who: '', pages: [], marked: [], page: 0, shown: 0, beat: 0, choices: null, sel: 0, cb: null };
const DLG_SIZE = THEME.sizes.dialog;   // dialogue and choice text size: the theme's (theme.json sizes.dialog; e.g. 14 for a rounded gothic in the 3-line box)
const DLG_LINE = THEME.sizes.dialogLine || 20;   // line pitch in the box (theme.json sizes.dialogLine)
const SUB_SIZE = THEME.sizes.subtitle || 12;                             // subtitles under the letterbox (05l_cinema.js)
const DLG_WRAP = 470, SUB_WRAP = 470;
// Pages of a line of text (job text-pass, 1 Nov 2026): a page holds at most `lines` lines and ends at the end of a sentence; a sentence
// longer than a page breaks at a clause (, ; : —), then between words. A blank line ('\n\n') starts a new page; '\n' breaks a line.
// Returns pages of marked lines (01_core.js marked text).
function pageText(text, maxW, size, lines) {
  const fits = t => wrap(t, maxW, size).length <= lines, pages = [];
  for (const para of String(text).split(/\n\s*\n/)) {
    const sents = para.split(/(?<=[.!?…]["”’')\]]*)\s+(?=\S)/).filter(x => x.trim()); let cur = '';
    const flush = () => { if (cur) pages.push(wrap(cur, maxW, size)); cur = ''; };
    for (const sn of sents) {
      const t = cur ? cur + ' ' + sn : sn;
      if (fits(t)) { cur = t; continue; }
      flush();
      if (fits(sn)) { cur = sn; continue; }
      for (const part of sn.split(/(?<=[,;:—])\s+/)) {   // a sentence longer than a page: clauses, then lines
        const u = cur ? cur + ' ' + part : part;
        if (fits(u)) { cur = u; continue; }
        flush();
        const ls = wrap(part, maxW, size);
        for (let i = 0; i < ls.length; i += lines) { const chunk = ls.slice(i, i + lines); if (chunk.length === lines || i + lines < ls.length) pages.push(chunk); else cur = chunk.join(' '); }
      }
    }
    flush();
  }
  return pages.length ? pages : [['']];
}
// a two-sentence subtitle breaks between its sentences when each fits one line; otherwise pages of at most two lines
function subtitlePages(text) {
  const ss = String(text).split(/(?<=[.!?…]["”’')\]]*)\s+(?=\S)/);
  if (ss.length === 2 && ss.every(x => wrap(x, SUB_WRAP, SUB_SIZE).length === 1)) return [ss];
  return pageText(text, SUB_WRAP, SUB_SIZE, 2);
}
function openDialog(who, text, opt = {}) {
  // {a} {start} ... name the keys of the active control scheme (01b_input.js), drawn as key caps; [[...]] is the highlight (01_core.js)
  const sub = typeof cineOn === 'function' && cineOn() && !(typeof CROWD === 'object' && CROWD.top);
  const marked = sub ? subtitlePages(text) : pageText(text, DLG_WRAP, DLG_SIZE, 3);
  Dialog.spr = speakerSprite(who);
  Object.assign(Dialog, { active: true, who, marked, pages: marked.map(pg => pg.map(markPlain)), page: 0, shown: 0, beat: 0, choices: opt.choices || null, sel: 0, cb: opt.cb || null });
}
// Text speed (Settings, 07c_settings.js): letters a frame at Normal / Fast, the whole page at Instant. A short beat after the end of a
// sentence and after '...' (GAME.text.beat frames at Normal, half at Fast; 0 = none) lets a joke's turn and a silence land.
const DLG_END = '.!?…', DLG_CLOSE = '"”’\')]';
function dialogBeatAt(s, i) {   // true when a beat belongs after the first i letters of s
  let j = i - 1; while (j >= 0 && DLG_CLOSE.includes(s[j])) j--;
  if (j < 0 || !DLG_END.includes(s[j])) return false;
  const nx = s[i]; return nx != null && !DLG_END.includes(nx) && !DLG_CLOSE.includes(nx);
}
function dialogUpdate() {
  const flat = Dialog.pages[Dialog.page].join(''), total = flat.length;
  if (Dialog.shown < total) {
    if (btn('a')) { Dialog.shown = total; Dialog.beat = 0; return; }
    const hurry = held('a') || held('b'), sp = textSpeed();
    if (Dialog.beat > 0 && !hurry) { Dialog.beat--; return; }
    if (sp === Infinity) { Dialog.shown = total; return; }
    const from = Dialog.shown, to = Math.min(total, from + (hurry ? 3 : sp)), beat = hurry || Dialog.choices ? 0 : textBeat();   // a question types without beats: its answers wait anyway
    Dialog.shown = to;
    if (beat) for (let i = from + 1; i <= to && i < total; i++) if (dialogBeatAt(flat, i)) { Dialog.shown = i; Dialog.beat = beat; break; }
    if (frame % 4 === 0) sfx('talk');
    return;
  }
  const last = Dialog.page === Dialog.pages.length - 1;
  if (last && Dialog.choices) {
    if (nav('up')) { Dialog.sel = (Dialog.sel + Dialog.choices.length - 1) % Dialog.choices.length; sfx('cursor'); }
    if (nav('down')) { Dialog.sel = (Dialog.sel + 1) % Dialog.choices.length; sfx('cursor'); }
    if (btn('a') || btn('b')) {
      const i = btn('b') ? Dialog.choices.length - 1 : Dialog.sel; sfx(btn('b') ? 'back' : 'ok');
      Dialog.active = false; const cb = Dialog.cb; cb && cb(i);
    }
    return;
  }
  if (btn('a') || btn('b')) {
    if (!last) { Dialog.page++; Dialog.shown = 0; Dialog.beat = 0; }
    else { Dialog.active = false; const cb = Dialog.cb; if (cb) cb(); else nextStep(); }
  }
}
// the hero thinking: his line in brackets, in the theme's soft ink (also under the letterbox, 05l_cinema.js)
const dialogThought = () => typeof isHeroName === 'function' && isHeroName(Dialog.who) && /^\(/.test((Dialog.pages[0] || [])[0] || '');
// speakerSprite(who) and castPortrait(who): the speaker's sprite spec and app portrait (01d_cast.js)
function drawDialog() {
  if (!Dialog.active) return;
  if (typeof cineSubs === 'function' && cineSubs()) return;   // Job 13: under the letterbox the dialog is a subtitle (05l_cinema.js)
  const y0 = typeof CROWD === 'object' && CROWD.top ? 24 : 266, pimg = castPortrait(Dialog.who) || (Dialog.spr && portrait(Dialog.spr)), hasP = !!pimg, x0 = hasP ? 110 : 20, w = 620 - x0;
  if (hasP) { win(18, y0 - 8, 86, 90); X.imageSmoothingEnabled = false; X.drawImage(pimg, 25 * S, (y0 - 1) * S, 72 * S, 72 * S); }
  win(x0, y0, w, 82);
  if (Dialog.who) { setFont(12, true); const nw = X.measureText(Dialog.who).width / S + 34; win(x0 + 8, y0 - 17, nw, 22, 1); txt(Dialog.who, x0 + 25, y0 - 12, '#f6d890', 12); }
  let left = Dialog.shown; const pg = Dialog.pages[Dialog.page], mk = Dialog.marked[Dialog.page] || pg, lead = THEME.sizes.dialogLine ? Math.round((82 - 3 * DLG_LINE) / 2) + Math.round((DLG_LINE - DLG_SIZE) / 2) - 1 : 12;
  const base = dialogThought() ? UI.soft : '#f4ecd8';
  mk.forEach((ln, i) => { txtMark(ln, x0 + 18, y0 + lead + i * DLG_LINE, base, DLG_SIZE, 'left', true, Math.max(0, left)); left -= pg[i].length; });
  const done = Dialog.shown >= pg.join('').length, n = Dialog.pages.length, last = Dialog.page === n - 1;
  if (done && !(Dialog.choices && last)) moreMark(x0 + w - 20, y0 + 66);
  if (n > 1) txt(`${Dialog.page + 1}/${n}`, x0 + w - 32, y0 + 62, '#8a7e66', 10, 'right', false);   // the page count of a line longer than one box
  if (done && Dialog.choices && last) {   // the choices sit on the box's top-right edge, at the dialogue's size
    const pitch = DLG_SIZE + 10, cw = Math.max(...Dialog.choices.map(c => txtW(c, DLG_SIZE))) + 52, ch = Dialog.choices.length * pitch + 14;
    win(620 - cw, y0 - ch - 20, cw, ch);
    Dialog.choices.forEach((c, i) => { const on = i === Dialog.sel, yy = y0 - ch - 13 + i * pitch; if (on) selBar(620 - cw + 10, yy - 3, cw - 20, pitch - 2); txt(c, 620 - cw + 30, yy, on ? '#fff' : '#a89c84', DLG_SIZE); if (on) cursor(620 - cw + 11, yy + 1 + (DLG_SIZE - 12) / 2); });
  }
}
const Script = { queue: [], active: false, done: null };
function run(steps, done) { Script.queue = steps.slice(); Script.done = done || null; Script.active = true; nextStep(); }
function nextStep() {
  while (Script.queue.length) {
    if (itemMomentGate()) return;
    const s = Script.queue.shift();
    if (!s) continue;
    if (typeof storyStep === 'function' && !Array.isArray(s) && typeof s === 'object' && !s.ask && !s.battle && !s.card) { const r = storyStep(s); if (r === 'wait') return; if (r === 'next') continue; }   // story steps (05d_story.js)
    if (typeof s === 'function') { const r = s(); if (Array.isArray(r)) Script.queue.unshift(...r); continue; }
    if (Array.isArray(s)) { openDialog(s[0], s[1]); return; }
    if (s.ask) { openDialog(s.who || '', s.ask, { choices: s.opts, cb: i => { Script.queue.unshift(...((s.then && s.then[i]) || [])); nextStep(); } }); return; }
    if (s.battle) { startBattle(s.battle, { ...s, onWin: () => { Script.queue.unshift(...(s.win || [])); nextStep(); } }); return; }   // s may carry paint, fog, noLose, noFlee (painted-scene battles)
    if (s.card) { G.card = { pages: s.card, i: 0, t: 0 }; return; }
    if (s.liberation) { G.stamp = { name: s.liberation, t: 0 }; playMusic('liberate'); sfx('stamp'); return; }
    if (s.shop) { openShop(s.shop); return; }
  }
  if (itemMomentGate()) return;
  if (typeof mapClipReset === 'function') mapClipReset();   // Job 18c: no map-scale strip outlives its script
  Script.active = false; if (typeof unstageParty === 'function' && !(typeof ST === 'object' && ST.sitSave)) unstageParty();   // Job 14: companions staged for this script step out of the picture
  const d = Script.done; Script.done = null; d && d();
}
function cardUpdate() {
  const c = G.card; c.t++;
  if (c.t === 1) cardPageShown(c.pages[c.i]);   // a date card sets the menu's date (card pages: 01a_game.js CARD_PAGES)
  if (c.t > 20 && btn('a')) {
    sfx('cursor'); if (cardPageNext(c)) return;   // a long letter or Chronicle entry turns its own pages first
    c.i++; c.t = 0; if (c.i >= c.pages.length) { G.card = null; if (c.onDone) c.onDone(); else nextStep(); }
  }
}
function drawCard() {
  const c = G.card; if (!c) return;
  const K = cardPageKind(c.pages[c.i]);
  if (K && K.card) { K.card(c); return; }   // a page that draws the whole card itself (the Chronicle's scroll, 05_chronicle.js)
  X.imageSmoothingEnabled = true; X.drawImage(uiPage(), 0, 0); X.imageSmoothingEnabled = false;
  const a = Math.min(1, c.t / 20), pg = c.pages[c.i];
  if (pg && typeof pg === 'object') { drawCardPage(pg, a, c); if (c.t > 20) moreMark(320, 330); return; }   // date cards, letters, epilogues (05_bonds.js)
  X.globalAlpha = a;
  const lines = wrap(c.pages[c.i], 470, 16, true), lh = 30, y0 = 172 - lines.length * lh / 2;
  lines.forEach((l, i) => headTxt(l, 320, y0 + i * lh, l.startsWith('END OF') ? UI.seal : UI.ink, 16, 'center', l.startsWith('END OF') ? 800 : 500, null));
  X.globalAlpha = 1;
  uiStamp(598, 306, 30, GAME.seal[0]);
  if (c.t > 20) moreMark(320, 330);
}
// job fw-F3b: object pages by kind (01a_game.js CARD_PAGES). drawCardPage draws one page on the washi sheet (a = fade-in alpha);
// cardPageNext turns a page's own sub-pages first (true = it handled the press); cardPageShown runs once when a page first shows.
function drawCardPage(o, a, c) { X.globalAlpha = a; const K = cardPageKind(o); if (K && K.draw) K.draw(o, a, c); X.globalAlpha = 1; }
function cardPageNext(c) {
  const o = c.pages[c.i], K = cardPageKind(o);
  if (K && K.pages && (c.sub | 0) < K.pages(o) - 1) { c.sub = (c.sub | 0) + 1; c.t = 0; return true; }
  c.sub = 0; return false;
}
function cardPageShown(o) { const K = cardPageKind(o); if (K && K.shown) K.shown(o); }
// the theme's full-screen sheet under cards, letters and the Chronicle (job fw-F4: the washi page is in themes/ink-washi/ui.js)
const uiPage = () => themeUI('page')();
// a small square stamp with one glyph (e.g. a red hanko)
function uiStamp(x, y, sz, glyph, rot = -0.05) { themeUI('stamp')(x, y, sz, glyph, rot); }
function stampUpdate() { const s = G.stamp; s.t++; if (s.t > 100 && btn('a')) { G.stamp = null; nextStep(); } }
function drawStamp() {
  const s = G.stamp; if (!s) return;
  themeUI('liberation')(s, GAME.liberation);   // job fw-F4: the look is the theme's, the text game.json's
  if (s.t > 100) moreMark(320, 330);
}

// ============================================================
//  Field update
// ============================================================
function fieldUpdate() {
  const m = G.map, p = G.p;
  if (G.safe > 0) G.safe--;
  if (G.banner) { G.banner.t--; if (G.banner.t <= 0) G.banner = null; }
  updateNpcs(m); updateEnemies(m);
  if (Script.active || G.fadeDir) return;
  if (!p.moving) {
    if (btn('start')) { openMenu(); return; }
    let d = -1;
    const hd = k => held(k) || btn(k);
    if (hd('up')) d = 1; else if (hd('down')) d = 0; else if (hd('left')) d = 2; else if (hd('right')) d = 3;
    if (d >= 0) {
      p.dir = d; const nx = p.x + DX[d], ny = p.y + DY[d];
      const st = stepCheck(m, p.x, p.y, d, null, true);
      if (st) { p.moving = true; p.tx = nx; p.ty = ny; p.hFrom = m.H[p.y][p.x]; p.hTo = m.H[ny][nx]; p.hop = !!st.hop; p.climb = !!st.climb; if (p.hop) sfx('flee'); }
      else if (Input.hold[['down', 'up', 'left', 'right'][d]] % 20 === 1) sfx('bump');
    } else if (btn('a')) interact();
  }
  if (p.moving) {
    const sp = p.hop ? 2 : p.climb ? (held('b') ? 4 : 2) : held('b') ? 8 : 4;
    const tx = p.tx * T, ty = p.ty * T;
    p.px += Math.sign(tx - p.px) * Math.min(sp, Math.abs(tx - p.px)); p.py += Math.sign(ty - p.py) * Math.min(sp, Math.abs(ty - p.py));
    p.step += sp;
    const f = 1 - (Math.abs(tx - p.px) + Math.abs(ty - p.py)) / T;
    p.h = p.hFrom + (p.hTo - p.hFrom) * (p.hop ? f * f : f);
    p.arc = p.hop ? Math.sin(f * Math.PI) * 14 : 0;
    if (p.px === tx && p.py === ty) {
      p.moving = false; p.x = p.tx; p.y = p.ty; p.h = p.hTo; p.arc = 0;
      if (p.hop) { sfx('bump'); for (let i = 0; i < 8; i++) PARTS.push({ x: p.px + 16 + rnd(-10, 10), y: p.py - p.h * T + 30, vx: rnd(-0.6, 0.6), vy: -rnd(0.1, 0.4), t: 0, life: 30, kind: 'dust' }); }
      p.hop = p.climb = false; onArrive();
    }
  }
  // enemy contact
  if (G.safe <= 0 && !G.fadeDir) for (const e of m.enemies) {
    if (e.stun > 0) continue;
    if (Math.abs(m.H[e.y][e.x] - (p.h == null ? m.H[p.y][p.x] : p.h)) > 0.5) continue;
    if (Math.abs(e.px - p.px) < 22 && Math.abs(e.py - p.py) < 22) { encounter(e); break; }
  }
}
function onArrive() {
  const m = G.map, p = G.p, key = p.x + ',' + p.y;
  const sp = m.sparkles.find(s => s.x === p.x && s.y === p.y);
  if (sp) { G.f['spark_' + sp.id] = 1; m.sparkles = m.sparkles.filter(s => s !== sp); sfx('item'); run(sp.fn()); return; }
  const b = m.doors[key];
  if (b && b.to) { sfx('door'); warp(() => enterInterior(b.to)); return; }
  if (m.ground[p.y][p.x] === 'D' && m.back) { sfx('door'); const [id, bx, by] = m.back; warp(() => enterMap(id, bx, by, 0, true)); return; }
  if (m.exits.some(e => e.x === p.x && e.y === p.y)) leaveToWorld();
}
function enterInterior(id) {
  const def = contentGet('maps', id)(G.f); const rows = def.grid;
  let dx = 0, dy = 0; rows.forEach((r, y) => r.forEach((c, x) => { if (c === 'D') { dx = x; dy = y; } }));
  enterMap(id, dx, dy - 1, 1);
}
function leaveToWorld() { warp(() => openWorld()); }
function frontTile() { const p = G.p; return [p.x + DX[p.dir], p.y + DY[p.dir]]; }
function interact() {
  const m = G.map; let [fx, fy] = frontTile();
  if (fx < 0 || fy < 0 || fx >= m.w || fy >= m.h || m.H[fy][fx] !== m.H[G.p.y][G.p.x]) return;
  let npc = m.npcs.find(n => n.x === fx && n.y === fy);
  if (!npc && m.prop[fy] && m.prop[fy][fx] === 'k') { const x2 = fx + DX[G.p.dir], y2 = fy + DY[G.p.dir]; npc = m.npcs.find(n => n.x === x2 && n.y === y2); }
  if (npc) { if (!npc.fixed) npc.dir = [1, 0, 3, 2][G.p.dir]; G.talkSpr = npc.spr; sfx('cursor'); run(npc.talk()); return; }
  const ch = m.chests.find(c => c.x === fx && c.y === fy);
  if (ch) {
    G.f['chest_' + ch.id] = 1; m.chests = m.chests.filter(c => c !== ch); m.opened = (m.opened || []).concat([ch]);
    if (ch.mon) { giveMon(ch.mon); run([['', `${GAME.hero.name} opens the box. Inside: ${ch.mon} ${GAME.currency.label.toLowerCase()}!`]]); }
    else { give(ch.item, ch.n); sfx('item'); run([['', `${GAME.hero.name} opens the box. Found ${contentGet('items', ch.item).name}${ch.n > 1 ? ' ×' + ch.n : ''}!`]]); }
    return;
  }
  const sg = m.signs[fx + ',' + fy];
  if (sg) { sfx('cursor'); run(sg()); return; }
  const b = m.footprint[fx + ',' + fy];
  if (b) {
    if (b.act && m.special[b.act]) { run(m.special[b.act]()); return; }
    if (b.door && b.door[0] === fx && b.door[1] === fy && !b.to && b.locked) { sfx('deny'); run([['', b.locked]]); return; }
  }
  if (m.prop[fy] && m.prop[fy][fx] === 'w') { run([['', 'An old stone well. The water is cold and clean.']]); return; }
  if (m.prop[fy] && m.prop[fy][fx] === 'n') { run([['', 'Straw bales packed with rice. The villagers\' stolen harvest.']]); return; }
}

function updateNpcs(m) {
  for (const n of m.npcs) {
    if (n.moving) {
      const tx = n.tx * T, ty = n.ty * T; n.px += Math.sign(tx - n.px) * 2; n.py += Math.sign(ty - n.py) * 2; n.step += 2;
      if (n.px === tx && n.py === ty) { n.moving = false; n.x = n.tx; n.y = n.ty; }
      continue;
    }
    if (!n.wander || Script.active) continue;
    if (--n.timer > 0) continue;
    n.timer = ri(80, 220);
    const d = ri(0, 3), nx = n.x + DX[d], ny = n.y + DY[d];
    n.dir = d;
    if (Math.abs(nx - n.hx) + Math.abs(ny - n.hy) > 3) continue;
    if (!stepCheck(m, n.x, n.y, d, n) || (G.p.x === nx && G.p.y === ny) || (G.p.tx === nx && G.p.ty === ny) || m.doors[nx + ',' + ny]) continue;
    n.moving = true; n.tx = nx; n.ty = ny;
  }
}
function updateEnemies(m) {
  const p = G.p;
  for (const e of m.enemies) {
    if (e.stun > 0) e.stun--;
    if (e.moving) {
      const tx = e.tx * T, ty = e.ty * T; e.px += Math.sign(tx - e.px) * 2; e.py += Math.sign(ty - e.py) * 2; e.step += 2;
      if (e.px === tx && e.py === ty) { e.moving = false; e.x = e.tx; e.y = e.ty; }
      continue;
    }
    if (Script.active || G.state !== 'field') continue;
    if (--e.timer > 0) continue;
    const dist = Math.abs(p.x - e.x) + Math.abs(p.y - e.y);
    let d;
    if (dist < 6 && e.stun <= 0 && Math.random() < 0.75) {
      const ddx = p.x - e.x, ddy = p.y - e.y;
      d = Math.abs(ddx) > Math.abs(ddy) ? (ddx < 0 ? 2 : 3) : (ddy < 0 ? 1 : 0);
      e.timer = ri(6, 16);
    } else { d = ri(0, 3); e.timer = ri(30, 90); }
    const nx = e.x + DX[d], ny = e.y + DY[d], z = e.zone;
    e.dir = d;
    if (nx < z.x || ny < z.y || nx >= z.x + z.w || ny >= z.y + z.h) continue;
    if (!stepCheck(m, e.x, e.y, d, null) || m.doors[nx + ',' + ny]) continue;
    if (m.enemies.some(o => o !== e && ((o.x === nx && o.y === ny) || (o.moving && o.tx === nx && o.ty === ny)))) continue;
    e.moving = true; e.tx = nx; e.ty = ny;
  }
}
function encounter(e) {
  sfx('encounter');
  G.flash = 24;
  startBattle(contentGet('parties', e.kind)(), { bg: e.zone.bg, fieldEnemy: e });
}

// ============================================================
//  Field render
// ============================================================
function enemyFieldSprite(e) {
  const def = contentGet('enemies', e.kind);
  if (def.kind) return creatureSprite(def.kind, (def.kind === 'crow' || def.kind === 'bat') ? Math.floor(frame / 8) % 2 : (e.moving ? Math.floor(e.step / 8) % 2 : 0), e.dir === 3);
  return charSprite(def.char, e.dir, walkFrame(e));
}
function walkFrame(o) { return o.moving ? [1, 0, 3, 0][Math.floor(o.step / 8) % 4] : 0; }
let SHADOW_C = {};
function shadowSprite(w, h) {
  const k = w + 'x' + h; if (SHADOW_C[k]) return SHADOW_C[k];
  const [c, g] = mk(w, h); const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  r.addColorStop(0, 'rgba(20,12,30,.42)'); r.addColorStop(0.65, 'rgba(20,12,30,.26)'); r.addColorStop(1, 'rgba(20,12,30,0)');
  g.setTransform(1, 0, 0, h / w, 0, 0); g.fillStyle = r; g.fillRect(0, 0, w, w);
  return (SHADOW_C[k] = c);
}
let VIGNETTE = null, CLOUD = null;
function vignette() {
  if (VIGNETTE) return VIGNETTE; const [c, g] = mk(W, H);
  const r = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62); r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, 'rgba(10,4,16,.5)');
  g.fillStyle = r; g.fillRect(0, 0, W, H); return (VIGNETTE = c);
}
function cloudShadow() {
  if (CLOUD) return CLOUD; const [c, g] = mk(360, 200);
  for (let i = 0; i < 9; i++) { const x = 60 + hash(i, 1) * 240, y = 50 + hash(1, i) * 100, r = 40 + hash(i, i) * 40; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(30,40,70,.5)'); gr.addColorStop(1, 'rgba(30,40,70,0)'); g.fillStyle = gr; g.fillRect(0, 0, 360, 200); }
  return (CLOUD = c);
}
const PARTS = [];
const SIL = new WeakMap();
function silhouette(spr) { let s = SIL.get(spr); if (s) return s; const [c, g] = mk(spr.width, spr.height); g.drawImage(spr, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#1a0e2a'; g.fillRect(0, 0, c.width, c.height); SIL.set(spr, c); return c; }
function castShadow(sg, spr, bx, by, k = 1) { // long directional shadow falling to the lower right
  sg.setTransform(1, 0, -0.62 * k, -0.34 * k, Math.round(bx), Math.round(by)); sg.drawImage(silhouette(spr), -spr.width / 2, -spr.height); sg.setTransform(1, 0, 0, 1, 0, 0);
}
function drawField() {
  const m = G.map, p = G.p;
  if (!m.baked) m.baked = bakeGround(m);
  if (!p.moving) { p.h = m.H[p.y][p.x]; p.arc = 0; }
  const tod = timeOfDay(m);
  const mw = m.w * T, mh = m.h * T, HT = (x, y) => m.H[y][x];
  const heroDY = p.py - p.h * T - (p.arc || 0);
  let cx = mw <= W ? Math.floor((mw - W) / 2) : clamp(Math.round(p.px + 16 - W / 2), 0, mw - W);
  let cy = mh <= H ? Math.floor((mh - H) / 2) : clamp(Math.round(heroDY + 16 - H / 2), m.minSY, mh - H);
  if (G.camOv) { cx = G.camOv[0]; cy = G.camOv[1]; } // debug/cutscene camera override
  G.cam = [cx, cy];
  faunaUpdate(m);
  L.fillStyle = '#07060a'; L.fillRect(0, 0, W, H);
  if (m.def.vista && cy < 140) {
    L.drawImage(vistaBG(), -Math.round(cx * 0.25), -80 - Math.round(cy * 0.45));
    for (let i = 0; i < 5; i++) { const bx = Math.round(((frame * 0.3 + i * 37) % (W + 80)) - 40), by = Math.round(14 + i * 5 - cy * 0.45 + Math.sin(frame / 25 + i) * 3), f = Math.floor(frame / 12 + i) % 2; L.fillStyle = PAL.night[1]; L.fillRect(bx, by, 2, 1); L.fillRect(bx - 3, by - f, 3, 1); L.fillRect(bx + 2, by - f, 3, 1); }
  }
  const x0 = Math.max(0, Math.floor(cx / T) - 1), x1 = Math.min(m.w - 1, Math.floor((cx + W) / T) + 1);
  const y0 = Math.max(0, Math.floor(cy / T) - 1), y1 = Math.min(m.h - 1, Math.floor((cy + H) / T) + m.maxH + 2);
  // ---- collect drawables per logical row ----
  const rows = new Map(), lights = [];
  const add = (row, base, fn) => { if (!rows.has(row)) rows.set(row, []); rows.get(row).push({ base, fn }); };
  if (!G.shC) G.shC = mk(W, H); const [shc, sg] = G.shC; sg.clearRect(0, 0, W, H); sg.imageSmoothingEnabled = false;
  const blob = (x, y, w, hh) => sg.drawImage(shadowSprite(w, hh), Math.round(x - w / 2), Math.round(y - hh / 2));
  const shK = tod.sh || 1;
  // reflections: whatever stands just above open water mirrors into it, rippling
  const isWater = (x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h && m.ground[y][x] === '~';
  const reflect = (spr, sx, baseY, tx, ty, alpha = 0.3) => {
    if (!m.outdoor || ty + 1 >= m.h) return;
    const tiles = []; for (let yy = ty + 1; yy <= Math.min(m.h - 1, ty + 2); yy++) for (let xx = tx - 2; xx <= tx + 2; xx++) if (isWater(xx, yy)) tiles.push([xx, yy]);
    if (!tiles.length || !isWater(tx, ty + 1)) return;
    add(Math.min(m.h - 1, ty + 2), -1, () => {
      L.save(); L.beginPath(); for (const [xx, yy] of tiles) L.rect(xx * T - cx, (yy - HT(xx, yy)) * T - cy, T, T); L.clip();
      L.globalAlpha = alpha;
      for (let r = 0; r < spr.height; r += 2) { const off = Math.round(Math.sin((r + frame * 0.6) / 5) * 1.2); L.drawImage(spr, 0, spr.height - r - 2, spr.width, 2, Math.round(sx) + off, Math.round(baseY) + r, spr.width, 2); }
      L.restore();
    });
  };
  for (let y = Math.max(0, y0); y <= Math.min(m.h - 1, y1 + 2); y++) for (let x = x0; x <= x1; x++) {
    const pr = m.prop[y][x]; if (!pr) continue;
    const spr = propLive(pr, m.pv[y][x], x * T + 16, y * T); if (!spr) continue;
    const info = PROP_INFO[pr] || {}, hh = HT(x, y);
    const bx = x * T + 16 - cx, by = (y - hh) * T + T - cy;
    const flat = pr === 'u' || pr === 'z' || pr === 'I' || pr === 'k';
    add(y, flat ? 0 : 30, () => L.drawImage(spr, Math.round(bx - spr.width / 2), by - spr.height));
    if ('TMYBLKbw'.includes(pr)) reflect(spr, Math.round(bx - spr.width / 2), by, x, y, 0.26);
    if (info.sh && m.outdoor && !flat) castShadow(sg, propSprite(pr, m.pv[y][x]), bx, by - 2, ('TMYB'.includes(pr) ? 1 : 0.8) * shK); else if (info.sh) blob(bx + 3, by - 2, info.sh[0], info.sh[1]);
    if (info.light) lights.push({ x: bx + info.light.x, y: by + info.light.y, r: info.light.r, col: info.light.col, flick: info.light.flick || 0.15 });
  }
  // live plants (grass, susuki, spider lilies, reeds, ferns) leaning in the wind
  const sw = m.baked.sway; if (sw && sw.length) {
    let lo = 0, hi = sw.length; const yTop = cy - 40; while (lo < hi) { const mid = (lo + hi) >> 1; if (sw[mid].y < yTop) lo = mid + 1; else hi = mid; }
    const yBot = cy + H + (m.maxH + 1) * T + 40;
    for (let i = lo; i < sw.length && sw[i].y < yBot; i++) {
      const s = sw[i]; if (s.x < cx - 30 || s.x > cx + W + 30) continue;
      const tx = s.x >> 5, ty = s.y >> 5; if (ty < y0 || ty > y1) continue; const hh = HT(tx, ty);
      const spr = plantSprite(s.kind, s.v, s.x, s.y), sx = s.x - cx - (spr.width >> 1), sy = s.y - hh * T - cy - spr.height + 1;
      if (sy > H || sy + spr.height < 0) continue;
      add(ty, 8 + (s.y & 31) / 2, () => L.drawImage(spr, sx, sy));
    }
  }
  for (const b of m.blds) {
    const baseRow = b.y + b.h - 1, hh = HT(b.x, baseRow);
    const bx = b.x * T - cx, by = (b.y - hh) * T - cy, fw = b.w * T, fh = b.h * T;
    if (bx > W + 80 || by > H + 100 || bx + fw < -80 || by + fh < -80) continue;
    const s = buildingSprite(b);
    add(baseRow, b.type === 'torii' ? 31 : 29, () => s.hi ? L.drawImage(s.hi, bx - s.ox, by - s.oy, s.c.width, s.c.height) : L.drawImage(s.c, bx - s.ox, by - s.oy));
    if (b.type !== 'cave' && b.type !== 'mound' && m.outdoor) castShadow(sg, s.c, bx + fw / 2, by + fh + 2, 0.55 * shK);
    for (const l of s.lights) lights.push({ x: bx + fw / 2 + l.x, y: by + fh + l.y, r: l.r, col: l.col, flick: l.flick || 0.2 });
    if (b.smoke && frame % 7 === 0) PARTS.push({ x: b.x * T + fw / 2 + b.smoke[0], y: (b.y + b.h - hh) * T + b.smoke[1] + 2, vx: rnd(0.1, 0.35), vy: -rnd(0.3, 0.5), t: 0, life: 140, kind: 'smoke' });
  }
  for (const c of m.chests) { const s = propSprite('Q', 0), hh = HT(c.x, c.y); blob(c.x * T + 16 - cx, (c.y - hh) * T + 30 - cy, 26, 7); add(c.y, 28, () => L.drawImage(s, c.x * T + 2 - cx, (c.y - hh) * T + 6 - cy)); }
  for (const c of (m.opened || [])) { const s = propSprite('q', 0), hh = HT(c.x, c.y); add(c.y, 28, () => L.drawImage(s, c.x * T + 2 - cx, (c.y - hh) * T + 6 - cy)); }
  for (const s of m.sparkles) {
    const ph = (frame + s.x * 13) % 80; if (ph > 36) continue;
    const sx = s.x * T - cx + 16, sy = (s.y - HT(s.x, s.y)) * T - cy + 16, k = (ph < 18 ? ph : 36 - ph) / 3;
    add(s.y, 1, () => { L.globalCompositeOperation = 'lighter'; L.globalAlpha = 0.8; L.drawImage(glowSprite(10, '#fff0b0'), sx - 10, sy - 10); L.globalAlpha = 1; L.globalCompositeOperation = 'source-over'; L.fillStyle = '#fffbe0'; L.fillRect(sx - Math.round(k), sy, Math.round(k) * 2 + 1, 1); L.fillRect(sx, sy - Math.round(k), 1, Math.round(k) * 2 + 1); });
  }
  const idle = o => (!o.moving && Math.floor((frame + (o.x || 0) * 7) / 40) % 2 ? 1 : 0);
  const rowOf = o => o.moving ? Math.max(o.y, o.ty) : o.y;
  for (const n of m.npcs) {
    const s = charSprite(n.spr, n.dir, walkFrame(n), idle(n)), hh = HT(n.x, n.y); const x = Math.round(n.px - cx), y = Math.round(n.py - hh * T - cy);
    blob(x + 16, y + 30, 22, 7);
    add(rowOf(n), 30 + (n.py % T) / 64, () => L.drawImage(s, x + 16 - (s.width >> 1), y + 32 - s.height));
    reflect(s, x + 16 - (s.width >> 1), y + 32, n.x, n.y);
    if (n.spr.torch) lights.push({ x: x + 26, y: y - 2, r: 70, col: '#ff8a30', flick: 0.8 });
  }
  for (const e of m.enemies) {
    if (e.stun > 0 && Math.floor(frame / 4) % 2) continue;
    const s = enemyFieldSprite(e), def = contentGet('enemies', e.kind), hh = HT(e.x, e.y);
    const fly = def.kind === 'crow' || def.kind === 'bat' ? -12 + Math.round(Math.sin(frame / 10 + e.x) * 3) : 0;
    const x = Math.round(e.px - cx + 16 - s.width / 2), y = Math.round(e.py - hh * T - cy + 32 - s.height) + fly;
    blob(e.px - cx + 16, e.py - hh * T - cy + 30, fly ? 16 : 24, fly ? 5 : 7);
    add(rowOf(e), 30 + (e.py % T) / 64, () => L.drawImage(s, x, y));
    if (def.char && def.char.torch) lights.push({ x: x + 26, y: y + 10, r: 60, col: '#ff8a30', flick: 0.8 });
  }
  const hs = charSprite(HERO_SPR, p.dir, walkFrame(p), idle(p));
  const hx = Math.round(p.px - cx), hy = Math.round(heroDY - cy), hyG = Math.round(p.py - p.h * T - cy);
  const hdx = hx + 16 - (hs.width >> 1), hdy = hy + 32 - hs.height;
  blob(hx + 16, hyG + 30, p.arc ? 16 : 22, p.arc ? 5 : 7);
  const drawHero = () => L.drawImage(hs, hdx, hdy);
  add(rowOf(p), 30.5 + (p.py % T) / 64, drawHero);
  if (!p.arc) reflect(hs, hdx, hdy + hs.height, Math.round(p.px / T), Math.round(p.py / T));
  drawFaunaShadows(sg, cx, cy);
  // ---- terrain, faces and objects, painted back to front one logical row at a time ----
  const shA = tod.shA || 0.34;
  const shade = (dx, dy, w, h) => { if (w <= 0 || h <= 0) return; L.globalAlpha = shA; L.imageSmoothingEnabled = true; L.drawImage(shc, dx, dy, w, h, dx, dy, w, h); L.imageSmoothingEnabled = false; L.globalAlpha = 1; };
  for (let y = y0; y <= y1; y++) {
    let x = x0;
    while (x <= x1) {
      const hh = HT(x, y); let e = x; while (e + 1 <= x1 && HT(e + 1, y) === hh) e++;
      const dx = x * T - cx, dy = (y - hh) * T - cy, w = (e - x + 1) * T;
      if (dy < H && dy > -T) {
        L.drawImage(m.baked.c, x * T, y * T, w, T, dx, dy, w, T);
        for (let k = x; k <= e; k++) { const gt = m.groundType(k, y); if (gt === 'water') { let q = k; while (q + 1 <= e && m.groundType(q + 1, y) === 'water') q++; drawWaterShimmer(k * T - cx, dy, (q - k + 1) * T, T, cx, cy + hh * T); k = q; } }
        shade(dx, dy, w, T);
        for (let k = x; k <= e; k++) {
          const kx = k * T - cx;
          if (y > 0 && HT(k, y - 1) > hh) L.drawImage(aoBand(), kx, dy);
          if (y > 0 && HT(k, y - 1) < hh && m.ground[y - 1][k] !== '%') { L.fillStyle = 'rgba(255,236,200,.35)'; L.fillRect(kx, dy, T, 1); L.fillStyle = 'rgba(20,10,30,.4)'; L.fillRect(kx, dy - 2, T, 2); }
          if (k > 0 && HT(k - 1, y) < hh) { L.fillStyle = 'rgba(20,10,30,.5)'; L.fillRect(kx, dy, 2, T); }
          if (k < m.w - 1 && HT(k + 1, y) < hh) { L.fillStyle = 'rgba(20,10,30,.5)'; L.fillRect(kx + T - 2, dy, 2, T); }
        }
      }
      x = e + 1;
    }
    if (y + 1 < m.h) for (let k = x0; k <= x1; k++) {
      const hh = HT(k, y), hs2 = HT(k, y + 1); if (hs2 >= hh) continue;
      const n = hh - hs2, stairs = m.stairs[y + 1][k];
      const style = stairs ? 'stairs' : m.faceStyle(k, y);
      const eL = k > 0 && HT(k - 1, y) - HT(k - 1, y + 1) < n && !m.stairs[y + 1][k - 1], eR = k < m.w - 1 && HT(k + 1, y) - HT(k + 1, y + 1) < n && !m.stairs[y + 1][k + 1];
      const fs = faceSprite(style, n, k, eL || (stairs && !m.stairs[y + 1][k - 1]), eR || (stairs && !m.stairs[y + 1][k + 1]));
      const dx = k * T - cx, dy = (y + 1 - hh) * T - cy;
      if (dy > H || dy + n * T < 0) continue;
      L.drawImage(fs, dx, dy); shade(dx, dy, T, n * T);
      if (style === 'fall' && frame % 5 === 0) PARTS.push({ x: k * T + rnd(4, 28), y: (y + 1 - hs2) * T + 2, vx: rnd(-0.3, 0.3), vy: -rnd(0.2, 0.5), t: 0, life: 40, kind: 'mist' });
    }
    const list = rows.get(y); if (list) list.sort((a, b) => a.base - b.base).forEach(d => d.fn());
  }
  if (m.baked.overlay) { const sway = Math.round(windAt(cx + 200) * 1); for (let y = y0; y <= y1; y++) { const hh = HT(0, y), dy = (y - hh) * T - cy; if (dy < H + T && dy > -3 * T) L.drawImage(m.baked.overlay, 0, y * T, mw, T, -cx + sway, dy, mw, T); } }
  // particles (smoke, dust, waterfall mist, fish rings)
  for (let i = PARTS.length - 1; i >= 0; i--) {
    const q = PARTS[i]; q.t++; q.x += q.vx; q.y += q.vy; if (q.t > q.life) { PARTS.splice(i, 1); continue; }
    if (q.kind === 'ring') { const r = 1 + q.t / 6, a = 1 - q.t / q.life; L.strokeStyle = `rgba(200,236,250,${a * 0.8})`; L.lineWidth = 1; L.beginPath(); L.ellipse(Math.round(q.x - cx) + 0.5, Math.round(q.y - cy) + 0.5, r * 2, r, 0, 0, 7); L.stroke(); continue; }
    const a = Math.sin(q.t / q.life * Math.PI) * (q.kind === 'smoke' ? 0.35 : 0.55), r = q.kind === 'smoke' ? 3 + q.t / 12 : 2 + q.t / 20;
    L.fillStyle = q.kind === 'dust' ? `rgba(200,170,120,${a})` : q.kind === 'mist' ? `rgba(230,244,250,${a})` : `rgba(180,176,170,${a})`; L.beginPath(); L.arc(q.x - cx, q.y - cy, r, 0, 7); L.fill();
  }
  if (PARTS.length > 140) PARTS.splice(0, PARTS.length - 140);
  drawFauna(cx, cy);
  // hero glimpsed through anything that hides him
  let hidden = false;
  for (let Y = p.y + 1; Y <= Math.min(m.h - 1, p.y + m.maxH + 1) && !hidden; Y++) for (const X of [p.x, Math.min(m.w - 1, p.x + (p.px % T ? 1 : 0))]) if (HT(X, Y) - p.h >= Y - p.y - 0.2) hidden = true;
  // ...or behind a roof or a tree drawn in front of him
  const occ = (spr, sx, sy) => {
    if (!spr.alpha) { const d = spr.getContext('2d').getImageData(0, 0, spr.width, spr.height).data; spr.alpha = new Uint8Array(spr.width * spr.height); for (let i = 0; i < spr.alpha.length; i++) spr.alpha[i] = d[i * 4 + 3] > 0 ? 1 : 0; }
    let n = 0; for (const [fx, fy] of [[0.5, 0.25], [0.5, 0.5], [0.5, 0.78], [0.3, 0.6], [0.7, 0.6]]) { const x = Math.round(hdx + hs.width * fx - sx), y = Math.round(hdy + hs.height * fy - sy); if (x >= 0 && y >= 0 && x < spr.width && y < spr.height && spr.alpha[y * spr.width + x]) n++; }
    return n >= 2;
  };
  const pRow = rowOf(p);
  if (!hidden) for (const b of m.blds) { const baseRow = b.y + b.h - 1; if (baseRow <= pRow || b.type === 'mound' || b.type === 'cave') continue; const s = buildingSprite(b), bx = b.x * T - cx - s.ox, by = (b.y - HT(b.x, baseRow)) * T - cy - s.oy; if (hdx > bx + s.c.width || hdx + hs.width < bx || hdy > by + s.c.height || hdy + hs.height < by) continue; if (occ(s.c, bx, by)) { hidden = true; break; } }
  if (!hidden) for (let y = pRow + 1; y <= Math.min(m.h - 1, pRow + 4) && !hidden; y++) for (let x = Math.max(0, p.x - 2); x <= Math.min(m.w - 1, p.x + 2); x++) { const pr = m.prop[y][x]; if (!pr || !'TMYBb'.includes(pr)) continue; const spr = propSprite(pr, m.pv[y][x]), sx = x * T + 16 - cx - Math.round(spr.width / 2), sy = (y - HT(x, y)) * T + T - cy - spr.height; if (occ(spr, sx, sy)) { hidden = true; break; } }
  if (hidden) { L.globalAlpha = 0.45; L.drawImage(silhouette(hs), hdx, hdy); L.globalAlpha = 0.35; drawHero(); L.globalAlpha = 1; }
  if (m.outdoor) {
    const cs = cloudShadow();
    for (let i = 0; i < 4; i++) { const wx = ((i * 760 + frame * 0.35) % (mw + 700)) - 350, wy = (i * 520 + 120) % Math.max(1, mh - 100); L.globalAlpha = 0.3; L.drawImage(cs, wx - cx, wy - cy); }
    L.globalAlpha = 1;
  }
  if (m.dark) lights.push({ x: hx + 16, y: hy + 6, r: 190 + Math.sin(frame / 9) * 4, col: '#ffc890', flick: 0.1, main: 1 });
  if (!m.outdoor) for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.ground[y][x] === 'D') lights.push({ x: x * T + 16 - cx, y: y * T + 28 - cy, r: 90, col: '#fff0d0', flick: 0 });
  lightingPass(m, lights, tod);
  if (tod.tint) { const gr = L.createLinearGradient(0, 0, W * 0.6, H); gr.addColorStop(0, tod.tint); gr.addColorStop(1, 'rgba(255,190,110,0)'); L.globalCompositeOperation = 'screen'; L.fillStyle = gr; L.fillRect(0, 0, W, H); L.globalCompositeOperation = 'source-over'; }
  drawGodRays(tod.rays);
  if (tod.flies) drawFireflies(cx, cy);
  if (m.outdoor) {
    if (G.leaves.length < 22 && Math.random() < 0.14) G.leaves.push({ x: rnd(0, W + 60), y: -6, vx: rnd(-0.7, -0.2), vy: rnd(0.35, 0.75), c: pick([PAL11.maple[8], PAL11.maple[6], PAL11.gold[8], PAL11.maple[9]]), d: PAL11.maple[4], ph: rnd(0, 6) });
    G.leaves = G.leaves.filter(l => {
      l.x += l.vx + Math.sin(frame / 22 + l.ph) * 0.4 + windAt(l.x + cx) * 0.25; l.y += l.vy;
      const f = Math.floor(frame / 7 + l.ph) % 4, lx = Math.round(l.x), ly = Math.round(l.y);
      L.fillStyle = 'rgba(20,12,30,.22)'; L.fillRect(lx + 10, ly + 18, 3, 1);
      L.fillStyle = l.c;
      if (f === 0) { L.fillRect(lx, ly, 3, 1); L.fillRect(lx + 1, ly + 1, 3, 1); L.fillStyle = l.d; L.fillRect(lx + 3, ly + 2, 1, 1); }
      else if (f === 1) { L.fillRect(lx + 1, ly, 1, 3); L.fillRect(lx, ly + 1, 3, 1); }
      else if (f === 2) { L.fillRect(lx, ly + 1, 4, 1); L.fillStyle = l.d; L.fillRect(lx + 1, ly + 2, 2, 1); }
      else { L.fillRect(lx, ly, 2, 2); L.fillRect(lx + 2, ly + 1, 1, 1); }
      return l.y < H + 4 && l.x > -6;
    });
  } else if (!m.dark) {
    for (let i = 0; i < 14; i++) { const x = (hash(i, 1) * W + Math.sin(frame / 90 + i) * 20), y = (hash(i, 2) * H - frame * 0.08 * (1 + hash(i, 3)) + H * 4) % H; L.fillStyle = 'rgba(255,236,190,.45)'; L.fillRect(x, y, 1, 1); }
  }
  L.drawImage(vignette(), 0, 0);
}
let AO_BAND = null;
function aoBand() { if (AO_BAND) return AO_BAND; const [c, g] = mk(T, 12); const gr = g.createLinearGradient(0, 0, 0, 12); gr.addColorStop(0, 'rgba(16,8,26,.55)'); gr.addColorStop(1, 'rgba(16,8,26,0)'); g.fillStyle = gr; g.fillRect(0, 0, T, 12); return (AO_BAND = c); }
function lightingPass(m, lights, tod) {
  if (!G.lightC) G.lightC = mk(W, H);
  const [lc, lg] = G.lightC;
  const amb = (tod || timeOfDay(m)).amb;
  lg.globalCompositeOperation = 'source-over'; lg.globalAlpha = 1; lg.fillStyle = amb; lg.fillRect(0, 0, W, H);
  lg.globalCompositeOperation = 'lighter';
  for (const l of lights) { if (l.x < -l.r || l.y < -l.r || l.x > W + l.r || l.y > H + l.r) continue; lg.globalAlpha = (l.main ? 1.4 : m.outdoor ? 0.45 : 0.9) * (1 - l.flick * 0.25 + Math.sin(frame / 5 + l.x) * l.flick * 0.12) * (l.amp == null ? 1 : l.amp); lg.drawImage(glowSprite(Math.round(l.r), l.col), l.x - l.r, l.y - l.r); }   // l.amp: a light's own brightness this frame (Job 16c2: the candle in the memorial lantern)
  lg.globalAlpha = 1; lg.globalCompositeOperation = 'source-over';
  L.globalCompositeOperation = 'multiply'; L.imageSmoothingEnabled = true; L.drawImage(lc, 0, 0); L.imageSmoothingEnabled = false;
  L.globalCompositeOperation = 'lighter';
  for (const l of lights) { if (l.main) continue; L.globalAlpha = m.outdoor ? 0.22 : 0.3; const r = Math.round(l.r * 0.35); L.drawImage(glowSprite(r, l.col), l.x - r, l.y - r); }
  L.globalAlpha = 1; L.globalCompositeOperation = 'source-over';
}
function interactTarget() {
  const m = G.map; if (!m || Script.active || G.p.moving) return null;
  const [fx, fy] = frontTile();
  if (fx < 0 || fy < 0 || fx >= m.w || fy >= m.h || m.H[fy][fx] !== m.H[G.p.y][G.p.x]) return null;
  if (m.npcs.some(n => n.x === fx && n.y === fy)) return [fx, fy, 'talk'];
  if (m.prop[fy] && m.prop[fy][fx] === 'k') { const x2 = fx + DX[G.p.dir], y2 = fy + DY[G.p.dir]; if (m.npcs.some(n => n.x === x2 && n.y === y2)) return [x2, y2, 'talk']; }
  if (m.chests.some(c => c.x === fx && c.y === fy)) return [fx, fy, 'open'];
  if (m.signs[fx + ',' + fy]) return [fx, fy, 'look'];
  const b = m.footprint[fx + ',' + fy]; if (b && (b.act || (b.door && b.door[0] === fx && b.door[1] === fy && !b.to && b.locked))) return [fx, fy, 'look'];
  return null;
}
// the area-name banner (tile maps and painted scenes alike); painted scenes count it down here, the field update does it on the tile maps
function drawBanner() {
  if (!G.banner) return;
  if (G.state === 'scene' && !Dialog.active) { G.banner.t--; if (G.banner.t <= 0) { G.banner = null; return; } }
  const a = clamp(Math.min(G.banner.t / 20, (150 - G.banner.t) / 15), 0, 1);
  uiBanner(G.banner.text, 320, 36, a, 16);
}
function drawFieldUI() {
  const t = interactTarget();
  if (t && G.cam) {
    const [tx, ty, kind] = t, x = tx * T + 16 - G.cam[0], y = (ty - G.map.H[ty][tx]) * T - 22 - G.cam[1] + Math.sin(frame / 8) * 1.5;
    uiBubble(x, y - 2, kind === 'talk' ? '…' : kind === 'open' ? '◆' : '?');
  }
  drawBanner();
  if (!Script.active && !G.f.hintShown && G.mapId === GAME.start.location && G.state === 'field') {
    const s = Input.touchMode ? 'A: talk / search     B (hold): run     MENU: pack' : `${keyName('a')}: talk / search     Hold ${keyName('b')}: run     ${keyName('start')}: menu`;
    win(140, 318, 360, 30); txt(s, 320, 326, '#e8dcc0', 11, 'center');
    if (G.p.moving && G.p.step > 400) G.f.hintShown = 1;
  }
}

// Job fw-F2: the tile-era field is a top-down mode (legacy; painted scenes replaced it, kept while old maps still load)
defineMode('field', { kit: 'topdown', update: () => fieldUpdate(), art: () => { if (G.map) drawField(); else { L.fillStyle = '#000'; L.fillRect(0, 0, W, H); } }, ui: () => { if (G.map) drawFieldUI(); } });
