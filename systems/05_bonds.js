// ============================================================
//  The bonds system: trust, rest-stop talks, date cards, letters, keepsakes and epilogue cards (job fw-F3b, 28 Oct 2026; was the engine
//  half of 05h_bonds.js, Job 8g, 10 Oct 2026)
//  A hidden trust count per companion grows through talks at the rest stops ("Sit with whom tonight?"); date cards are chapter cards
//  with real dates (the menu shows the last one's label); letters catch up with the hero between chapters, their bodies built from the
//  flags when read; the Keepsakes page lists keepsakes carried, letters received and epilogue cards seen, to read again.
//  Card pages (01a_game.js CARD_PAGES): { kind: 'date', over, title, place, date, era, glyphs, label, art }, { kind: 'letter', from,
//  note, body, sign, seal, art }, { kind: 'epilogue', over, title, entries: [{ who, text }], real }.
//  State: the save namespace sys.bonds = { trust: { companion id: n }, heard: { talk id: 1 }, letters: [letter ids, in the order received],
//  epilogues: { epilogue id: 1 }, date: the last date card's label or null }. The game reads it through trust(id), talkHeard(id),
//  letterGive(id) and bondsDate(), never by its keys.
//  Reads only the game's content (01a_game.js):
//    talks       { companion id: [{ id, when?(), steps() }] }   in order; the first not yet heard is offered once its `when` holds
//    bondWords   { companion id: [three words] }                 the Status page's bond, by trust 0, 1-2, 3+
//    restStops   { place: { intro, ask?, skip?, stage?() } }     see restEvening
//    keepsakes   { item id: () => ({ name, text }) }             items shown on the Keepsakes page instead of Items
//    letters     { id: () => letter page }, letterNames { id: name on the Keepsakes page }
//    epilogues   { id: { name, desc, over, historyTitle?, roadTitle?, history(), road() } }   entries: { who, text }
//    allies      (05_party.js) for a companion's name
// ============================================================

// ---------------- trust ----------------
defineSaveSpace('bonds', { init: () => ({ trust: {}, heard: {}, letters: [], epilogues: {}, date: null }) });
const bondsState = () => sysState('bonds');
const trust = id => bondsState().trust[id] | 0;
function trustUp(id, n = 1) { bondsState().trust[id] = trust(id) + n; }
const talkHeard = id => !!bondsState().heard[id];   // a rest-stop talk (or the game's own talk) has been heard
function talkMark(id) { bondsState().heard[id] = 1; }
// a letter catches up with the hero: true the first time (it joins the Keepsakes page), false if he already has it
function letterGive(id) { const L = bondsState().letters; if (L.includes(id)) return false; L.push(id); return true; }
const bondsDate = () => bondsState().date;   // the last date card's label (the menu's date), null before the first
// a word for the Status page (the number stays hidden)
function bondWord(id) { const w = contentGet('bondWords', id); if (!w) return ''; const t = trust(id); return w[t >= 3 ? 2 : t >= 1 ? 1 : 0]; }

// ---------------- rest-stop talks ----------------
// Each companion has talks in order; the first one not yet heard is offered once its `when` holds. A talk ends in one
// choice: the answer that really listens adds 1 trust (the game's talk calls trustUp), a cold one adds nothing.
function nextTalk(id) {
  if (!inParty(id)) return null;
  for (const t of contentGet('talks', id) || []) { if (talkHeard(t.id)) continue; return !t.when || t.when() ? t : null; }
  return null;
}
// the evening at a rest stop, played before the rest itself; [] when nobody has anything to say. The place's look comes from the game
// (content restStops[place]: { intro, ask?, skip?, stage?() -> { open?, talkIn?(id, opt), talkOut?(), close? } }; open and close are the
// steps before and after, talkIn / talkOut wrap each talk). opt = { next (who has a talk), intro, solo (steps when nobody talks), ... }
function restEvening(place, opt = {}) {
  const next = opt.next || nextTalk;
  const ids = Object.keys(G.allies || {}).filter(id => next(id));
  if (!ids.length) return opt.solo || [];
  const R = contentGet('restStops', place) || {}, st = (R.stage && R.stage()) || {}, intro = opt.intro || R.intro;
  const talk = id => { const t = next(id); return [...(st.talkIn ? st.talkIn(id, opt) : []), () => { talkMark(t.id); }, ...t.steps(), ...(st.talkOut ? st.talkOut() : [])]; };
  return ['open' in st ? st.open : { dim: 0.42, time: 40 }, ['', intro],
    { ask: R.ask || 'Sit with whom tonight?', opts: [...ids.map(id => allyDef(id).name), R.skip || 'Just sleep'], then: [...ids.map(talk), []] },
    'close' in st ? st.close : { dim: 0, time: 30 }];
}

// ---------------- keepsakes ----------------
function keepsakeList() {
  const out = [];
  for (const id in content('keepsakes')) if (has(id)) out.push({ k: id });
  for (const l of bondsState().letters) if (contentGet('letters', l)) out.push({ letter: l });
  for (const c in content('epilogues')) if (bondsState().epilogues[c]) out.push({ epi: c });   // the epilogue cards, once seen (Job 8g follow-ups)
  return out;
}
const keepName = e => e.k ? contentGet('keepsakes', e.k)().name : e.epi ? contentGet('epilogues', e.epi).name : contentGet('letterNames', e.letter) || 'A letter';
const keepDesc = e => e.k ? contentGet('keepsakes', e.k)().text : e.epi ? contentGet('epilogues', e.epi).desc : keyText('{a}: read it again.');
function keepUse(e) {
  if (e.letter) { sfx('ok'); G.card = { pages: [contentGet('letters', e.letter)()], i: 0, t: 0, onDone: () => {} }; }
  else if (e.epi) { sfx('ok'); G.card = { pages: epilogueCards(e.epi), i: 0, t: 0, onDone: () => {} }; }
  else sfx('cursor');
}

MENU_STOCK.keepsakes = { label: 'Keepsakes', when: () => keepsakeList().length > 0, list: () => keepsakeList(), use: it => keepUse(it), info: it => keepDesc(it),
  row: it => ({ name: keepName(it), right: it.letter ? 'letter' : 'keepsake', icon: it.k || (it.letter ? 'letter_' + it.letter : null) }) };

// ---------------- the card pages: date cards, letters, epilogues ----------------
// a painting crop turned into the theme's illustration for a card (e.g. a soft sumi-e wash; themes/ink-washi/ui.js 'artWash').
// art = { img (asset name), r: [x0, y0, x1, y1] in the scene's painting px }; w = width in logical px. Cached.
const ART_WASH = {};
function uiArtWash(art, w) {
  const key = art.img + ':' + art.r.join(',') + ':' + w;
  if (key in ART_WASH) return ART_WASH[key];
  const img = assetImg(art.img); if (!img) return (ART_WASH[key] = null);
  const def = SCENES[art.img], iw = def && def.iw ? def.iw : img.width, sc = img.width / iw;
  const [x0, y0, x1, y1] = art.r, sw = (x1 - x0) * sc, sh = (y1 - y0) * sc, h = Math.round(w * sh / sw);
  return (ART_WASH[key] = themeUI('artWash')(img, x0 * sc, y0 * sc, sw, sh, Math.round(w * S), Math.round(h * S), art.r[0] * 7 + art.r[1] + w));
}
// called by drawCard (05_field.js) for object pages; a = fade-in alpha; c = the card state (c.sub = letter page)
function drawDatePage(o, a) {
  const art = o.art && uiArtWash(o.art, 252);
  if (art) X.drawImage(art, 46 * S, Math.round((176 - art.height / S / 2) * S));
  const cx = art ? 448 : 320;
  if (o.glyphs) { X.globalAlpha = a * 0.08; [...o.glyphs].forEach((g, i) => headTxt(g, 606, 34 + i * 46, UI.ink, 40, 'center', 800, null)); X.globalAlpha = a; }
  headTxt(o.over.toUpperCase().split('').join(' '), cx, 90, UI.soft, 11, 'center', 700, null);
  headTxt(o.title, cx, 110, UI.ink, 30, 'center', 800, null);
  uiStroke(X, (cx - 84) * S, 156 * S, (cx + 84) * S, 158 * S, 5 * S, mulberry(31), UI.seal, 0.85 * a, 1);
  wrap(o.place, 300, 12.5, true).forEach((l, i) => headTxt(l, cx, 170 + i * 17, UI.soft, 12.5, 'center', 500, null));
  headTxt(o.date, cx, 210, UI.seal, 19, 'center', 700, null);
  headTxt(o.era, cx, 238, UI.faint, 11.5, 'center', 500, null);
  uiStamp(598, 306, 30, GAME.seal[0]);
}
// letter layout: header, the ink picture top right, the body flowing round it (narrow beside the picture, full width below),
// then the signature and the writer's seal. Long letters run on to a second page.
const LT = { x: 64, top: 72, lh: 15.5, size: 11.5, narrow: 336, wide: 520, bottom: 318, artX: 414, artY: 40, artW: 176 };
function letterLayout(o) {
  if (o._lay) return o._lay;
  const art = o.art && uiArtWash(o.art, LT.artW), artBot = art ? LT.artY + art.height / S + 8 : 0;
  setFont(LT.size, true);
  const pages = [[]]; let y = LT.top, pg = 0;
  const widthAt = yy => (pg === 0 && yy < artBot) ? LT.narrow : LT.wide;
  const push = s => { if (y + LT.lh > LT.bottom) { pages.push([]); pg++; y = 60; } pages[pg].push({ s, y }); y += LT.lh; };
  const paras = String(o.body).split('\n');
  paras.forEach((para, pi) => {
    let line = '';
    for (const w of para.split(' ')) { const t = line ? line + ' ' + w : w; if (X.measureText(t).width / S > widthAt(y) && line) { push(line); line = w; } else line = t; }
    push(line); if (pi < paras.length - 1) y += 4;
  });
  return (o._lay = { art, pages, endY: y });
}
const letterPages = o => letterLayout(o).pages.length;
function drawLetterPage(o, a, sub) {
  const lay = letterLayout(o), last = sub === lay.pages.length - 1;
  if (sub === 0) {
    headTxt(o.from, LT.x, 34, UI.seal, 15, 'left', 700, null);
    if (o.note) headTxt('(' + o.note + ')', LT.x, 54, UI.faint, 10.5, 'left', 500, null);
    if (lay.art) X.drawImage(lay.art, LT.artX * S, LT.artY * S);
  } else headTxt(o.from + ' (continued)', LT.x, 34, UI.faint, 11, 'left', 700, null);
  for (const ln of lay.pages[sub]) headTxt(ln.s, LT.x, ln.y, UI.ink, LT.size, 'left', 500, null);
  if (last) {
    const sy = Math.min(318, (sub === 0 ? lay.endY : lay.pages[sub][lay.pages[sub].length - 1].y + LT.lh) + 2);
    headTxt('— ' + o.sign, 548, sy, UI.ink, 14, 'right', 700, null);
    if (o.seal) uiStamp(556, sy - 6, 24, o.seal, 0.06);
  }
}
// advancing a card: a long letter turns its own pages first. Returns true when it handled the press.

// ---------------- epilogue cards ----------------
// the card pages for an epilogue: history first, then the player's road, a few entries to a page
function epilogueCards(c) {
  const E = contentGet('epilogues', c); if (!E) return [];
  bondsState().epilogues[c] = 1;   // kept on the Keepsakes page from now on
  const pages = [], add = (title, entries, real) => {
    let pg = [], h = 0;
    for (const e of entries) {
      const eh = 18 + wrap(e.text, EP.w, EP.size, true).length * EP.lh + EP.gap;
      if (pg.length && h + eh > EP.room) { pages.push({ kind: 'epilogue', over: E.over, title, entries: pg, real }); pg = []; h = 0; }
      pg.push(e); h += eh;
    }
    if (pg.length) pages.push({ kind: 'epilogue', over: E.over, title, entries: pg, real });
  };
  add(E.historyTitle || E.name, E.history(), true);
  add(E.roadTitle || '', E.road(), false);
  return pages;
}
const EP = { x: 92, w: 456, size: 12, lh: 16, gap: 10, top: 104, room: 204 };
function drawEpiloguePage(o, a) {
  headTxt(o.over.toUpperCase().split('').join(' '), 320, 34, UI.soft, 11, 'center', 700, null);
  headTxt(o.title, 320, 52, UI.ink, 24, 'center', 800, null);
  uiStroke(X, 236 * S, 88 * S, 404 * S, 90 * S, 4 * S, mulberry(47), UI.seal, 0.8 * a, 1);
  const hgt = o.entries.reduce((t, e) => t + 18 + wrap(e.text, EP.w, EP.size, true).length * EP.lh + EP.gap, -EP.gap);
  let y = EP.top + Math.max(0, Math.round((EP.room + 10 - hgt) / 2));   // a short page sits in the middle of the sheet
  for (const e of o.entries) {
    uiStamp(EP.x - 14, y + 7, 9, o.real ? '史' : '縁', 0.05);
    headTxt(e.who, EP.x, y, o.real ? UI.ink : UI.seal, 13.5, 'left', 800, null); y += 18;
    for (const l of wrap(e.text, EP.w, EP.size, true)) { headTxt(l, EP.x, y, o.real ? UI.soft : UI.ink, EP.size, 'left', 500, null); y += EP.lh; }
    y += EP.gap;
  }
  uiStamp(598, 306, 30, GAME.seal[0]);
}


// job fw-F3b: the bonds system's card pages (01a_game.js CARD_PAGES; drawn and turned by 05_field.js drawCard / cardUpdate)
defineCardPage('date', { draw: (o, a) => drawDatePage(o, a), shown: o => { if (o.label) bondsState().date = o.label; } });   // a date card sets the date the menu shows
defineCardPage('letter', { draw: (o, a, c) => drawLetterPage(o, a, c.sub | 0), pages: o => letterPages(o) });   // a long letter turns its own pages
defineCardPage('epilogue', { draw: (o, a) => drawEpiloguePage(o, a) });
