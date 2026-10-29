// ============================================================
//  The party system (job fw-F3b, 28 Oct 2026; was the engine half of 05g_party.js, Job 8f, plus the Techniques and Party pages and
//  the party lines of 06_menu.js)
//  Companions who join the hero: their stats and techniques, joining, the battle line-up (the hero + up to PARTY_MAX), staging a
//  companion in a painted scene for a scripted beat, and followers who walk behind the hero there. Companions share the hero's level
//  (the party levels together), keep their own HP and Ki, and carry their own weapons (no equipment slots).
//  State: the save namespace sys.party = { allies: { id: { id, hp, ki, techs } }, active: [the ids who fight] }, read as G.allies / G.active.
//  The battle code (07_battle.js) and the menu (06_menu.js) read everything through partyAll(), battleParty(), memberStats().
//  Reads only the game's content and hooks (01a_game.js):
//    allies      { id: { name, cast, weapon (its name), role, stat: lv => { maxHp, maxKi, atk, def, spd }, techs: [technique ids] } }
//    techniques  { id: { name, ki, target ('self' | 'ally' | 'allies' | ...), healPct?, field? (usable from the menu), desc } }
//    partyTalk   { id: () => script steps }   what a companion says when talked to (the Party page, a follower faced in a scene)
//    game.json   party.max (companions in a fight), party.full / party.title / party.help (texts that name that number)
//    hooks       followers() -> [{ id, cast }]   followers on the map who are not party members
// ============================================================
const PARTY_MAX = GAME.party.max;   // companions in a fight beside the hero
const allyDef = id => contentGet('allies', id);
const partyTalkSteps = id => { const t = contentGet('partyTalk', id); return t ? t() : null; };
const inParty = id => !!(G.allies && G.allies[id]);
function newAlly(id) { const d = allyDef(id), s = d.stat(G.hero.lv); return { id, hp: s.maxHp, ki: s.maxKi, techs: d.techs.slice() }; }
const memberName = m => m === G.hero ? GAME.hero.name : allyDef(m.id).name;
// the hero's numbers by level: the content kind `progression` { stats(h) -> { maxHp, maxKi, atk, def, spd }, xpTo(lv) -> the XP that reaches level lv,
// techs: { level: technique id } }. A game without one gets a flat default.
const PROGRESSION_DEFAULT = { stats: h => ({ maxHp: 40 + (h.lv - 1) * 8, maxKi: 10 + (h.lv - 1) * 2 + (h.bonus.ki || 0), atk: 6 + (h.lv - 1) * 2 + (h.bonus.atk || 0), def: 3 + (h.lv - 1), spd: 6 + (h.lv - 1) }), xpTo: lv => Math.round(10 * Math.pow(lv - 1, 1.7)), techs: {} };
const progression = () => Object.assign({}, PROGRESSION_DEFAULT, CONTENT.progression ? content('progression') : {});
const heroStats = h => progression().stats(h);
const xpToReach = lv => progression().xpTo(lv);
const levelTechs = () => progression().techs || {};
const memberCast = m => m === G.hero ? heroCastId() : allyDef(m.id).cast;
function memberStats(m) { return m === G.hero ? heroStats(m) : allyDef(m.id).stat(G.hero.lv); }
// everyone who has joined, the hero first, in the order they joined
function partyAll() { return [G.hero, ...Object.keys(G.allies || {}).map(id => G.allies[id])]; }
// the members who fight: the hero and up to PARTY_MAX active companions
function battleParty() { return [G.hero, ...(G.active || []).filter(id => G.allies && G.allies[id]).slice(0, PARTY_MAX).map(id => G.allies[id])]; }
function joinParty(id) {
  G.allies = G.allies || {}; G.active = G.active || [];
  if (!G.allies[id]) G.allies[id] = newAlly(id);
  if (G.active.length < PARTY_MAX && !G.active.includes(id)) G.active.push(id);
  // Job 14: the NPC who joins leaves the scene (no follower: the companion is in the menu and in battles from now on)
  if (G.state === 'scene' || SC.def) { const n = scNpc(id); if (n) SC.npcs = SC.npcs.filter(x => x !== n); }
  G.banner = { text: allyDef(id).name + ' joins the party', t: 150 };
  sfx('levelup');
}
// a companion leaves the party for good (job fw-F5a, gap G15): out of the roster and the fighting line; no banner unless the game passes text
function leaveParty(id, banner) {
  if (G.allies) delete G.allies[id];
  G.active = (G.active || []).filter(a => a !== id);
  if (banner) G.banner = { text: banner, t: 150 };
}
// a level-up, a rest or waking after a defeat: everyone back to full
function partyRestore() { for (const m of partyAll()) { const s = memberStats(m); m.hp = s.maxHp; m.ki = s.maxKi; } }
// after a won fight anyone who went down gets back up with 1 HP
function partyGetUp() { const up = []; for (const m of battleParty()) if (m.hp <= 0) { m.hp = 1; up.push(memberName(m)); } return up; }
// The party's state is its save namespace, sys.party (01c_save.js; job fw-F3b): G.allies and G.active read and write it, so every caller
// works as before; New Journey (G.sys = {}) starts with nobody.
defineSaveSpace('party', { init: () => ({ allies: {}, active: [] }) });
for (const k of ['allies', 'active'])
  Object.defineProperty(G, k, { get: () => sysState('party')[k], set: v => { sysState('party')[k] = v || (k === 'allies' ? {} : []); }, configurable: true });


// ---------------- followers in the painted scenes ----------------
// Each follower walks behind the hero along the path he actually took (a breadcrumb trail of his feet), spaced
// by FOLLOW_GAP logical px x heroK, so they never cut corners through walls. They are not solid and never trigger anything.
const FOLLOW_GAP = 18;
function followersReset(spawn) {   // spawn = { id, x, y, dir }: a follower who was an NPC starts where the NPC stood
  const h = SC.hero; if (!h) return;
  SC.trail = [{ x: h.x, y: h.y }];
  const old = SC.followers || [];
  // Job 14: a companion is here only while a scene has staged him (stageAlly); the game may add followers who are not party members
  // (job fw-F3b: GAME_HOOKS.followers() -> [{ id, cast }]; e.g. a child tags along in the safe scenes)
  SC.staged = (SC.staged || []).filter(id => inParty(id));
  const extra = gameHook('followers') || [], ids = [...SC.staged, ...extra.map(e => e.id)];
  const castOf = id => { const a = allyDef(id), e = extra.find(e => e.id === id); return a ? a.cast : e && e.cast; };
  SC.followers = ids.map((id, i) => {
    const o = old.find(f => f.id === id), f = { id, cast: castOf(id), x: h.x, y: h.y, dir: h.dir, moving: false, step: 0 };
    if (spawn && spawn.id === id) Object.assign(f, { x: spawn.x, y: spawn.y, dir: spawn.dir });
    else if (o && SC.followersScene === SC.id) Object.assign(f, { x: o.x, y: o.y, dir: o.dir });
    else {   // a fresh scene: stand in a short line behind him (against his facing), on ground he could stand on
      const back = [[0, -1], [0, 1], [1, 0], [-1, 0]][h.dir] || [0, 1], d = FOLLOW_GAP * scHK() * (i + 1) * 0.7;
      const x = h.x + back[0] * d, y = h.y + back[1] * d;
      if (scMoverOk(x, y)) { f.x = x; f.y = y; }
    }
    return f;
  });
  SC.followersScene = SC.id;
}
// Job 14: put a companion in the scene beside the hero for one scripted beat (a rest-stop talk, a supper, a test); `at` = { x, y, dir } to place him.
function stageAlly(id, at) {
  if (!inParty(id) || !SC.hero) return null;
  SC.staged = SC.staged || [];
  if (!SC.staged.includes(id)) { SC.staged.push(id); const keep = (SC.followers || []).map(f => [f.id, f.x, f.y, f.dir]); followersReset(); for (const [fid, x, y, d] of keep) { const f = SC.followers.find(f => f.id === fid); if (f) Object.assign(f, { x, y, dir: d }); } }
  const f = SC.followers.find(f => f.id === id); if (f && at) Object.assign(f, { x: at.x, y: at.y, dir: at.dir == null ? f.dir : at.dir, moving: false });
  return f || null;
}
function stageParty() { for (const id of Object.keys(G.allies || {})) stageAlly(id); }
// take every staged companion out of the picture again (a follower who is not a party member stays)
function unstageParty() {
  if (!SC.staged || !SC.staged.length) return;
  SC.staged = []; SC.followers = (SC.followers || []).filter(f => !allyDef(f.id));
}
function followersUpdate() {
  const h = SC.hero; if (!h || !SC.followers || !SC.followers.length) return;
  if (!SC.trail || !SC.trail.length) SC.trail = [{ x: h.x, y: h.y }];
  const last = SC.trail[SC.trail.length - 1];
  if (Math.hypot(h.x - last.x, h.y - last.y) >= 1) { SC.trail.push({ x: h.x, y: h.y }); if (SC.trail.length > 400) SC.trail.shift(); }
  const gap = FOLLOW_GAP * scHK();
  SC.followers.forEach((f, i) => {
    // the point on his trail (i + 1) gaps behind him
    let need = gap * (i + 1), tx = SC.trail[0].x, ty = SC.trail[0].y, px = h.x, py = h.y;
    for (let j = SC.trail.length - 1; j >= 0; j--) {
      const p = SC.trail[j], d = Math.hypot(px - p.x, py - p.y);
      if (d >= need) { const t = need / d; tx = px + (p.x - px) * t; ty = py + (p.y - py) * t; need = 0; break; }
      need -= d; px = p.x; py = p.y; tx = p.x; ty = p.y;
    }
    const dx = tx - f.x, dy = ty - f.y, dist = Math.hypot(dx, dy), sp = SC_SPEED * scHK() * 2;
    if (dist > 90 * scHK()) { f.x = tx; f.y = ty; f.moving = false; return; }   // fell far behind (a warp, a script move): catch up at once
    if (dist < 0.4) { f.moving = false; return; }
    const s = Math.min(sp, dist); f.x += dx / dist * s; f.y += dy / dist * s;
    f.moving = s > 0.3; if (f.moving) { f.step += 1; f.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : (dy < 0 ? 1 : 0); }
  });
}
// pushed into drawScene's depth-sorted actor list (05c)
function followerActs(acts, hk) {
  for (const f of SC.followers || []) if (!f.hidden) acts.push({ y: f.y, f: f.sit ? () => sitDraw(f, f.cast, f.sit, hk) : () => {   // Job 8g-r1: hidden (gone to bed) or sitting / asleep by the fire
    if (f.mclip && typeof mapClipDrawActor === 'function' && mapClipDrawActor(f, hk)) return;   // Job 18c: a drawn map-scale strip (05n_mapclip.js)
    if (typeof fsArtDrawFollower === 'function' && fsArtDrawFollower(f, hk)) return;
    const fr = f.moving ? [1, 0, 3, 0][Math.floor(f.step / 7) % 4] : 0, s = castSprite(f.cast, f.dir, fr); if (!s) return;
    const w = s.width / (2 * (s.q || 1)) * hk, ht = s.height / (2 * (s.q || 1)) * hk, bob = f.moving && fr === 0 ? 1 : 0;
    const lift = f.lift || 0, al = f.alpha == null ? 1 : f.alpha, ss = 1 - Math.min(0.35, lift / 80);   // a companion mid-hop: sprite lifted, shadow stays on the ground (Job 8d)
    L.globalAlpha = 0.75 * al * (1 - Math.min(0.5, lift / 60)); L.drawImage(shadowSprite(18, 6), f.x - 9 * hk * ss, f.y - 3 * hk, 18 * hk * ss, 6 * hk); L.globalAlpha = al;
    const x = Math.round((f.x - w / 2) * 2) / 2, y = Math.round((f.y - ht + 1 - bob - lift) * 2) / 2;
    if (typeof popSprite === 'function') popSprite(L, s, x, y, w, ht); else L.drawImage(s, x, y, w, ht);   // the same outline and lift as everyone else
    L.globalAlpha = 1;
  } });
}
// the follower the hero is facing (turn round and press Z)
function followerAt(px, py) {
  const f_ = scHK();
  for (const f of SC.followers || []) if (!f.hidden && px > f.x - 10 * f_ && px < f.x + 10 * f_ && py > f.y - 30 * f_ && py < f.y + 8 * f_) return f;
  return null;
}
function followerTalk(f) {
  const h = SC.hero, dx = h.x - f.x, dy = h.y - f.y;
  f.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : (dy < 0 ? 1 : 0);
  sfx('ok'); G.talkSpr = null;
  run(partyTalkSteps(f.id) || []);
}
function partyKiFull() { for (const m of partyAll()) m.ki = memberStats(m).maxKi; }


// Job fw-F3a: companions on the map in the painted scene's depth-sorted actors (01a_game.js, 05c SCENE_SLOTS)
defineLayer('actors', 'party', { owner: 'system:party', order: 400, fn: (acts, hk) => followerActs(acts, hk) });

// ---------------- the pause menu's Techniques and Party pages (moved from 06_menu.js) ----------------
// a field technique: a heal on oneself ('self'), on one member ('ally': pick who), or on everyone standing ('allies')
function useTechField(m, id) {
  const t = contentGet('techniques', id), nm = memberName(m);
  if (!t.field) { sfx('deny'); return menuMsg('Only usable in battle.'); }
  if (m.ki < t.ki) { sfx('deny'); return menuMsg('Not enough Ki.'); }
  const heal = x => { const s = memberStats(x); const before = x.hp; x.hp = Math.min(s.maxHp, x.hp + Math.round(s.maxHp * t.healPct)); return x.hp - before; };
  if (t.target === 'self') { const s = memberStats(m); if (m.hp >= s.maxHp) return menuMsg('HP is already full.'); m.ki -= t.ki; heal(m); sfx('heal'); return menuMsg(`${t.name}. HP ${m.hp}/${s.maxHp}`); }
  if (t.target === 'allies') { if (partyAll().every(x => x.hp >= memberStats(x).maxHp)) return menuMsg('Everyone is already well.'); m.ki -= t.ki; partyAll().forEach(heal); sfx('heal'); return menuMsg(`${nm}: ${t.name}. Everyone feels better.`); }
  if (t.target === 'ally') { Menu.pick = { kind: 'tech', id, m, i: 0 }; sfx('ok'); }
}
// the member chosen for an item (05_items.js useItemField) or a healing technique
function menuPickDo(target) {
  const pk = Menu.pick; Menu.pick = null;
  if (pk.kind === 'item') return useItemOn(pk.id, target);
  const t = contentGet('techniques', pk.id), s = memberStats(target);
  if (target.hp >= s.maxHp) return menuMsg(`${memberName(target)}'s HP is already full.`);
  pk.m.ki -= t.ki; target.hp = Math.min(s.maxHp, target.hp + Math.round(s.maxHp * t.healPct)); sfx('heal');
  menuMsg(`${memberName(pk.m)}: ${t.name}. ${memberName(target)} HP ${target.hp}/${s.maxHp}`);
}
// the Party page: who fights beside the hero (PARTY_MAX at most); the others stay in reserve. Job 14: the companions are not on the map,
// so the page is also where the hero talks to them (Right; the same lines facing a follower gives)
function partyToggle(m) {
  if (m === G.hero) { sfx('deny'); return menuMsg(`${GAME.hero.name} always fights.`); }
  const a = G.active, id = m.id, i = a.indexOf(id);
  if (i >= 0) { a.splice(i, 1); sfx('back'); return menuMsg(`${memberName(m)} will stay out of fights.`); }
  if (a.length >= PARTY_MAX) { sfx('deny'); return menuMsg(gameText(GAME.party.full)); }
  a.push(id); sfx('ok'); menuMsg(`${memberName(m)} will fight beside ${GAME.hero.name}.`);
}
function partyTalk(m) {
  if (m === G.hero || Menu.prev !== 'scene' || !contentGet('partyTalk', m.id)) { sfx('deny'); return menuMsg(m === G.hero ? `${GAME.hero.name} has nothing to say to himself.` : 'Not now.'); }
  closeMenu(); sfx('ok'); G.talkSpr = null; run(partyTalkSteps(m.id));   // the menu closes and the companion speaks (portrait, trust-gated closer lines)
}
MENU_STOCK.techniques = { label: 'Techniques', members: true, list: m => m.techs, use: (it, m) => useTechField(m, it), info: it => contentGet('techniques', it).desc,
  title: m => partyAll().length > 1 ? `Techniques — ${memberName(m)}` : 'Techniques',
  row: it => { const t = contentGet('techniques', it); return { name: t.name, right: t.ki + ' Ki' }; } };
MENU_STOCK.party = { label: 'Party', when: () => Object.keys(G.allies || {}).length > 0, list: () => partyAll(), use: it => partyToggle(it), right: it => partyTalk(it),
  title: () => gameText(GAME.party.title), foot: () => [keyText(gameText(GAME.party.help)), '#f4ecd8'],
  row: it => ({ name: memberName(it), right: it === G.hero || (G.active || []).includes(it.id) ? '◆ Fights' : 'Reserve' }) };
