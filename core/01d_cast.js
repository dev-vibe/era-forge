// ============================================================
//  The cast: people, sheets, portraits (job fw-F5a, 29 Oct 2026; gaps G1-G3, G14)
//  A game's people are the content kind `cast` (registerContent('cast', [...])): { id, name, note } entries, one per person who has an
//  app-made walking sheet (assets/game/char_<id>.png, 3x3 cells of 84x100: rows front / back / left profile, right mirrored; columns
//  stand / stride / stride) and portrait (portrait_<id>.png). `name` is the speaker label dialogue lines use ('Old Man', 'Hill Farmer'),
//  matched without accents. The hero is GAME.hero (game.json): `name`, `cast` (the hero's sheet id) and an optional `doll`, the paper-doll
//  spec of the procedural stand-in some games keep (the game draws it through the hooks below). Nothing here names a person.
//  Hooks the game may set (all optional; without them the engine paints the STAND-IN figures of 01e_standin.js when game.json
//  `standIn` is true, and returns null otherwise):
//    paperDoll(o, dir, fr, idle, scale)  a procedural figure for a spec object o (a game with no sheet for someone)
//    paperPortrait(o)                    the same for a portrait
//    creature(kind, fr, right)           a procedural creature (an enemy's `kind`)
//    speakerSprite(who)                  the spec a dialogue speaker's label stands for (their portrait, in a tile-era dialogue)
//    heroVariant()                       a suffix naming the hero's other sheet while it applies (char_<cast>_<variant>, e.g. a disguise)
//  CAST_I is the scene tests' "who am I playing" switch (0 = the hero; scene tests step it with the number keys).
// ============================================================
const CAST_CELL = [84, 100], CAST_SPR_CACHE = {}, PORTRAIT_CACHE = {};
// sheets are 3x3 cells of 84x100 logical px; a hi-res sheet has Q x that many pixels per cell and is drawn at the same logical size
const sheetQ = sheet => Math.max(1, Math.round(sheet.width / (CAST_CELL[0] * 3)));
const castList = () => { const c = content('cast'); return Array.isArray(c) ? c : Object.values(c); };
const accentless = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
let CAST_I = 0;
const heroCastId = () => { const c = CAST_I && castList()[CAST_I]; return c ? c.id : GAME.hero.cast; };
// the hero as a sprite spec: the marker the engine passes to charSprite / portrait (and the paper doll, when the game has one)
const HERO_SPR = Object.assign({ hero: 1 }, GAME.hero.doll || {});
const isHeroName = who => !!who && who === GAME.hero.name;
const heroHis = () => ({ him: 'his', her: 'her', them: 'their' }[GAME.hero.pronoun] || 'their');

// one frame of a person's walking sheet (dir 0 front, 1 back, 2 left, 3 right; fr 0 stand, 1 and 3 the strides), or null
function castSprite(id, dir, fr) {
  const sheet = assetImg('char_' + id); if (!sheet) return null;
  const col = fr === 1 ? 1 : fr === 3 ? 2 : 0, row = dir === 3 ? 2 : dir, key = id + ':' + row + ':' + col + (dir === 3 ? 'R' : '');
  if (CAST_SPR_CACHE[key]) return CAST_SPR_CACHE[key];
  const q = sheetQ(sheet), w = CAST_CELL[0] * q, h = CAST_CELL[1] * q, c = document.createElement('canvas'); c.width = w; c.height = h; c.q = q;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  if (dir === 3) { g.translate(w, 0); g.scale(-1, 1); }
  g.drawImage(sheet, col * w, row * h, w, h, 0, 0, w, h);
  return (CAST_SPR_CACHE[key] = c);
}
// the hero's frame: the played cast entry's sheet, or its `variant` sheet (char_<id>_<variant>) while the game says one applies
function heroSprite(dir, fr, variant) {
  let id = heroCastId();
  if (variant && IMG['char_' + id + '_' + variant]) id = id + '_' + variant;
  return castSprite(id, dir, fr);
}
// a figure for a sprite spec: the paper doll the game draws for it (hook paperDoll), else a person's sheet (o.cast, or the hero), else a stand-in
function charSprite(o, dir, fr, idle = 0, scale = 1) {
  o = o || HERO_SPR;
  const d = gameHook('paperDoll', o, dir, fr, idle, scale); if (d) return d;
  const s = o.hero ? heroSprite(dir, fr) : o.cast ? castSprite(o.cast, dir, fr) : null; if (s) return s;
  return standInFigure(o.hero ? heroCastId() : o.cast || 'figure', dir, fr);
}
// a portrait (72x72 logical): the person's app portrait (the hero's, for HERO_SPR), else the game's paper-doll portrait, else a stand-in
function portrait(o) {
  o = o || HERO_SPR;
  const id = o.hero ? heroCastId() : o.cast, im = id && assetImg('portrait_' + id);
  if (im) {
    if (PORTRAIT_CACHE[id]) return PORTRAIT_CACHE[id];
    const c = document.createElement('canvas'); c.width = c.height = 72 * S;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(im, 0, 0, c.width, c.height);
    return (PORTRAIT_CACHE[id] = c);
  }
  return gameHook('paperPortrait', o) || standInPortrait(id || 'figure');
}
function creatureSprite(kind, fr, right) { return gameHook('creature', kind, fr, right) || standInCreature(kind, fr, right); }
// the app-made portrait of a dialogue speaker in the cast, if there is one (the hero's follows HERO_SPR, see drawDialog)
function castPortrait(who) {
  if (!who || isHeroName(who)) return null;
  const n = accentless(who), c = castList().find(e => e.name === n);
  return c ? assetImg('portrait_' + c.id) : null;
}
// the sprite spec a dialogue speaker's label stands for: the hero, else the game's (hook speakerSprite), else the last person talked to
function speakerSprite(who) {
  if (!who) return null;
  if (isHeroName(who)) return HERO_SPR;
  return gameHook('speakerSprite', who) || G.talkSpr || null;
}
