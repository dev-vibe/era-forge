// ============================================================
//  The items system (job fw-F3b, 28 Oct 2026; was 05n_items.js (Job 12g item moments) plus the shop and the item pages of 06_menu.js)
//  Item moments: the small "+1" badges, the notable notice (gear, techniques, a large purse) and the story-item sheet; the item and
//  equipment pages of the pause menu; shops. Inventory transactions stay in their helpers (give, take, giveMon, giveWeapon... in
//  05_field.js). Transient moment state is never saved: loading a journey must not replay old rewards.
//  Reads only the game's content (01a_game.js), never a game's tables by name:
//    items       { name, desc, price?, hp?, ki?, escape?, key? (a key item), quiet? (no automatic notice: the game stages it itself),
//                  taken? (the label shown when it leaves the pack, e.g. 'Given to the smith') }
//    weapons     { name, atk, desc, price?, art?() -> a canvas drawn instead of the icon in its notice, shine? (a glint across it) }
//    armors      { name, def, desc, price? }
//    techniques  { name, ki, desc, ... }   (the notice when one is learned)
//    itemStory   { id: [name, line] }      things that are not items but get a story notice (a document, a letter): art item_<id>
//    keepsakes   { id: ... }               items listed on the Keepsakes page (05_bonds.js) instead of Items
//    shops       { id: { title, items?, weapons?, armors?, surcharge?() -> { mult, label } or null } }
//  The currency is game.json `currency` (id, label, line, notableAt: from this many coins a gain is a notable notice).
//  Asset names: icon_<id> (icon_weapon_<id>, icon_armor_<id>, icon_tech_<id>) and item_<id> (story sheets).
// ============================================================
const ItemFX = { small: [], pending: [], active: null, quiet: false };
const itemDef = id => contentGet('items', id);
const gearDef = (kind, id) => contentGet(kind === 'w' ? 'weapons' : 'armors', id);
function itemFXReset() { ItemFX.small = []; ItemFX.pending = []; ItemFX.active = null; }
function itemInfo(id, kind = 'i') {
  const d = kind === 'w' || kind === 'a' ? gearDef(kind, id) : kind === 'tech' ? contentGet('techniques', id) : itemDef(id), C = GAME.currency;
  if (d) return { name: d.name, line: d.desc || '', icon: (kind === 'w' ? 'weapon_' : kind === 'a' ? 'armor_' : kind === 'tech' ? 'tech_' : '') + id };
  if (id === C.id) return { name: C.label, line: C.line, icon: C.id };
  const s = contentGet('itemStory', id); return s ? { name: s[0], line: s[1], icon: id } : null;
}
function itemIcon(id, x, y, size = 20) {
  const img = assetImg('icon_' + id);
  X.save(); X.imageSmoothingEnabled = true;
  if (img) X.drawImage(img, x * S, y * S, size * S, size * S);
  else { X.globalAlpha *= .5; uiMark(x + size / 2, y + size / 2, size / 4); }
  X.restore();
}
function itemOrigin() {
  // UI-safe anchor; animations must work in a menu, a battle and the tile fallback too.
  if (G.state === 'shop') return [220, 100];
  if (G.state === 'battle') return [320, 150];
  return [320, 186];
}
function itemNotice(id, kind = 'i', n = 1, opts = {}) {
  if (ItemFX.quiet || !G.hero || G.state === 'title' || G.state === 'intro' || !(n > 0)) return;
  const info = itemInfo(id, kind); if (!info) return;
  const story = opts.story || kind === 'i' && itemDef(id) && itemDef(id).key;
  // An item marked quiet has an explicit, timed moment of its own in the game's script (e.g. a rosary).
  if (kind === 'i' && itemDef(id) && itemDef(id).quiet && !opts.story) return;
  const tier = story ? 'story' : kind === 'w' || kind === 'a' || kind === 'tech' || id === GAME.currency.id && n >= GAME.currency.notableAt ? 'notable' : 'small';
  const e = { id, kind, n, ...info, tier, t: 0, out: 0, ens: null, stamped: false,
    dest: opts.dest || (story ? 'Chronicle' : 'Pack'), line: opts.line || info.line,
    stat: opts.stat || '', reverse: !!opts.reverse, use: !!opts.use, target: opts.target || null,
    origin: opts.origin || itemOrigin(), state: G.state, frame };
  if (tier === 'small') {
    const prev = ItemFX.small.find(p => p.id === id && p.use === e.use && p.frame === frame);
    if (prev) prev.n += n; else ItemFX.small.push(e);
  } else ItemFX.pending.push(e);
}
function itemStory(id, opts = {}) { itemNotice(id, 'i', 1, { ...opts, story: true }); }
function itemTaken(id, n) {
  const dest = itemDef(id) && itemDef(id).taken;
  if (dest) itemNotice(id, 'i', n, { reverse: true, dest });
}
function itemUsed(id, member, at) {
  itemNotice(id, 'i', 1, { use: true, target: at || [400, 66], line: memberName(member) });
}
function itemGear(id, kind, before, after) {
  itemNotice(id, kind, 1, { stat: `${kind === 'w' ? 'Attack' : 'Defense'} ${before} → ${after}` });
}
function itemStart(resume) {
  if (ItemFX.active || !ItemFX.pending.length) return false;
  const e = ItemFX.pending.shift(); e.resume = resume; e.state = G.state;
  e.img = assetImg((e.tier === 'story' ? 'item_' : 'icon_') + (e.tier === 'story' ? e.id : e.icon));
  ItemFX.active = e; sfx(e.tier === 'story' ? 'card_turn' : 'item'); return true;
}
// nextStep uses this between transactions and the following dialog, including a final transaction.
function itemMomentGate() {
  if (ItemFX.active) return true;
  if (!ItemFX.pending.length || Dialog.active || G.card || CINE.keep) return false;
  return itemStart(true);
}
function itemFXTick() {
  if (!ItemFX.active) ItemFX.small.forEach(e => e.t++);
  ItemFX.small = ItemFX.small.filter(e => e.t < 64 && e.state === G.state);
  const a = ItemFX.active;
  if (a) {
    if (a.state !== G.state) { itemFXReset(); return false; }
    a.t++;
    if (!a.stamped && a.t >= (a.tier === 'story' ? 74 : 44)) { a.stamped = true; sfx('stamp'); }
    const ready = a.tier === 'story' ? 96 : 64;
    if (!a.out && a.t > ready && (btn('a') || btn('b'))) a.out = 1;
    if (a.out && ++a.out > 18) {
      ItemFX.active = null;
      if (a.resume) nextStep();
    }
    return true; // consume the dismissal frame; it must not also select an item or advance dialog
  }
  if (ItemFX.pending.length && !Dialog.active && !G.card && !G.stamp && !G.fadeDir && !CINE.keep &&
      (!Script.active || G.state === 'shop') &&
      (G.state !== 'battle' || B.phase === 'win' || B.phase === 'cmd')) return itemStart(false);
  return false;
}
function drawItemFX() {
  const a = ItemFX.active;
  if (a) {
    if (a.tier === 'story') {
      X.save();
      // Hand-over closes the illustrated sheet toward the recipient after its reading beat.
      if (a.reverse && a.out) { const k = a.out / 19; X.translate(170 * k * S, -45 * k * S); X.globalAlpha = 1 - k; }
      drawKeepsake(a); X.restore();
    } else {
      X.save(); const fade = Math.min(1, a.t / 20) * (a.out ? 1 - a.out / 19 : 1);
      X.globalAlpha = fade; X.fillStyle = 'rgba(9,6,4,.6)'; X.fillRect(0, 0, W * S, H * S);
      win(166, 76, 308, 214); drawEnso(a, 320, 145, 43, Math.min(1, a.t / 38));
      const gw = a.kind === 'w' && gearDef('w', a.id), art = gw && gw.art && gw.art();   // a weapon with its own art (e.g. a forged blade)
      if (a.kind === 'tech' && !assetImg('icon_' + a.icon)) headTxt('技', 320, 124, UI.ink, 34, 'center', 600, null);   // Job 12j: a technique icon (icon_tech_<id>) replaces the kanji when its art exists
      else if (art) { X.save(); X.imageSmoothingEnabled = true; X.drawImage(art, 278 * S, 103 * S, 84 * S, 84 * S); X.restore(); }
      else itemIcon(a.icon, 278, 103, 84);
      headTxt(a.name + (a.id === GAME.currency.id ? ` +${a.n}` : ''), 320, 202, UI.ink, 16, 'center', 700, null);
      if (a.stat) headTxt(a.stat, 320, 231, UI.soft, 13, 'center', 500, null);
      else wrap(a.line, 260, 11).slice(0, 2).forEach((line, i) => headTxt(line, 320, 229 + 15 * i, UI.soft, 11, 'center', 500, null));
      if (gw && gw.shine && a.t < 60) { X.strokeStyle = '#fff6d8'; X.lineWidth = 2 * S; X.beginPath(); X.moveTo((278 + a.t * 1.4) * S, 114 * S); X.lineTo((285 + a.t * 1.4) * S, 165 * S); X.stroke(); }
      if (a.t > 64 && !a.out) moreMark(320, 272); X.restore();
    }
    return;
  }
  // Ordinary moments never block movement or combat. Quantity badges are coalesced per transaction frame.
  ItemFX.small.slice(-3).forEach((e, i) => {
    const end = e.target || [534, 36 + i * 39], p = Math.min(1, e.t / 25), k = 1 - Math.pow(1 - p, 3);
    const x = e.origin[0] + (end[0] - e.origin[0]) * k, y = e.origin[1] + (end[1] - e.origin[1]) * k - Math.sin(p * Math.PI) * 35;
    X.save(); X.globalAlpha = Math.min(1, e.t / 7, (64 - e.t) / 14);
    itemIcon(e.icon, x - 13, y - 13, 26);
    if (e.t > 22) {
      if (e.use) { X.strokeStyle = UI.seal; X.lineWidth = S; X.beginPath(); X.arc(end[0] * S, end[1] * S, (10 + (e.t - 22) * .7) * S, 0, Math.PI * 2); X.stroke(); }
      else { win(456, end[1] - 14, 174, 32); itemIcon(e.icon, 462, end[1] - 11, 24); headTxt(`+${e.n} ${e.name}`, 493, end[1] - 5, UI.ink, 11, 'left', 600, null); }
    }
    X.restore();
  });
}

// ---------------- the pause menu's item and equipment pages (moved from 06_menu.js) ----------------
function invList() {
  const ids = Object.keys(G.inv).filter(k => G.inv[k] > 0 && !contentGet('keepsakes', k));   // keepsakes live on their own page (05_bonds.js)
  return ids.sort((a, b) => (itemDef(a).key ? 1 : 0) - (itemDef(b).key ? 1 : 0));
}
function equipList() { return [...G.hero.weapons.map(id => ({ t: 'w', id })), ...G.hero.armors.map(id => ({ t: 'a', id }))]; }
// an item used on one member (in a party, the member is picked first)
function useItemOn(id, m) {
  const it = itemDef(id), s = memberStats(m), nm = memberName(m);
  if (it.hp) { if (m.hp >= s.maxHp) return menuMsg(`${nm}'s HP is already full.`); m.hp = Math.min(s.maxHp, m.hp + it.hp); take(id); itemUsed(id, m); sfx('heal'); return menuMsg(`${nm}: ${it.name}. HP ${m.hp}/${s.maxHp}`); }
  if (it.ki) { if (m.ki >= s.maxKi) return menuMsg(`${nm}'s Ki is already full.`); m.ki = Math.min(s.maxKi, m.ki + it.ki); take(id); itemUsed(id, m); sfx('ki'); return menuMsg(`${nm}: ${it.name}. Ki ${m.ki}/${s.maxKi}`); }
}
function useItemField(id) {
  const it = itemDef(id);
  if (it.hp || it.ki) { if (partyAll().length > 1) { Menu.pick = { kind: 'item', id, i: 0 }; sfx('ok'); return; } return useItemOn(id, G.hero); }
  if (it.escape) return menuMsg('Use it in battle to escape.');
  sfx('cursor'); menuMsg(it.desc);
}
MENU_STOCK.items = { label: 'Items', list: () => invList(), use: it => useItemField(it), info: it => itemDef(it).desc,
  row: it => { const d = itemDef(it); return { name: d.name, right: d.key ? 'key item' : '× ' + G.inv[it], icon: it }; } };
MENU_STOCK.equip = { label: 'Equip', list: () => equipList(), info: it => gearDef(it.t, it.id).desc || '',
  pick: () => { const m = menuMember(); if (m === G.hero) return true; sfx('deny'); menuMsg(`${memberName(m)} keeps their own gear: ${contentGet('allies', m.id).weapon}.`); return false; },
  row: it => { const h = G.hero, d = gearDef(it.t, it.id); let name = d.name; if ((it.t === 'w' ? h.weapon : h.armor) === it.id) name = '◆ ' + name;
    return { name, right: it.t === 'w' ? 'Atk +' + d.atk : 'Def +' + d.def, icon: (it.t === 'w' ? 'weapon_' : 'armor_') + it.id }; },
  use: it => {
    const before = heroStats(G.hero), changed = (it.t === 'w' ? G.hero.weapon : G.hero.armor) !== it.id;
    if (it.t === 'w') G.hero.weapon = it.id; else G.hero.armor = it.id;
    if (changed) itemGear(it.id, it.t, it.t === 'w' ? before.atk : before.def, it.t === 'w' ? heroStats(G.hero).atk : heroStats(G.hero).def);
    sfx('ok'); menuMsg(`Equipped ${gearDef(it.t, it.id).name}.`);
  } };

// ---------------- shops (moved from 06_menu.js) ----------------
const Shop = { id: null, sel: 0, list: [], msg: '', msgT: 0 };
function openShop(id) {
  const s = contentGet('shops', id); Shop.id = id; Shop.sel = 0; Shop.msg = ''; Shop.msgT = 0;
  Shop.list = [...(s.items || []).map(i => ({ t: 'i', id: i, d: itemDef(i) })), ...(s.weapons || []).map(i => ({ t: 'w', id: i, d: gearDef('w', i) })), ...(s.armors || []).map(i => ({ t: 'a', id: i, d: gearDef('a', i) }))];
  Shop.prev = G.state; G.state = 'shop';
}
// a shop's surcharge while the game says so (e.g. a war tax until the town is free): { mult, label } or null
const shopSurcharge = () => { const s = contentGet('shops', Shop.id); return (s && s.surcharge && s.surcharge()) || null; };
const shopPrice = e => { const c = shopSurcharge(); return Math.round(e.d.price * (c ? c.mult : 1)); };
function shopUpdate() {
  if (Shop.msgT > 0) Shop.msgT--;
  const n = Shop.list.length + 1;
  if (nav('up')) { Shop.sel = (Shop.sel + n - 1) % n; sfx('cursor'); }
  if (nav('down')) { Shop.sel = (Shop.sel + 1) % n; sfx('cursor'); }
  const leave = () => { G.state = Shop.prev; sfx('back'); nextStep(); };
  if (btn('b')) return leave();
  if (btn('a')) {
    if (Shop.sel === Shop.list.length) return leave();
    const e = Shop.list[Shop.sel], price = shopPrice(e), h = G.hero;
    const owned = e.t === 'w' ? h.weapons.includes(e.id) : e.t === 'a' ? h.armors.includes(e.id) : false;
    if (owned) { sfx('deny'); Shop.msg = 'You already own that.'; Shop.msgT = 90; return; }
    if (h.mon < price) { sfx('deny'); Shop.msg = `Not enough ${GAME.currency.id}.`; Shop.msgT = 90; return; }
    h.mon -= price; sfx('coin');
    if (e.t === 'i') { give(e.id); Shop.msg = `Bought ${e.d.name}.`; }
    else if (e.t === 'w') { const better = e.d.atk > gearDef('w', h.weapon).atk; giveWeapon(e.id, better); Shop.msg = `Bought ${e.d.name}.` + (better ? ' Equipped.' : ''); }
    else { const better = e.d.def > gearDef('a', h.armor).def; giveArmor(e.id, better); Shop.msg = `Bought ${e.d.name}.` + (better ? ' Equipped.' : ''); }
    Shop.msgT = 100;
  }
}
function drawShop() {
  X.fillStyle = 'rgba(6,4,12,.45)'; X.fillRect(0, 0, W * S, H * S);
  const x = 16, y = 16, w = 380, h = Shop.list.length * 26 + 66;
  win(x, y, w, h);
  txt((contentGet('shops', Shop.id) || {}).title || '', x + 18, y + 12, '#f6d890', 14);
  Shop.list.forEach((e, i) => {
    const yy = y + 42 + i * 26, on = i === Shop.sel, hh = G.hero;
    const owned = e.t === 'w' ? hh.weapons.includes(e.id) : e.t === 'a' ? hh.armors.includes(e.id) : false;
    if (on) selBar(x + 14, yy - 4, w - 28, 21);
    itemIcon((e.t === 'w' ? 'weapon_' : e.t === 'a' ? 'armor_' : '') + e.id, x + 38, yy - 3, 22);
    txt(e.d.name, x + 64, yy, on ? '#fff' : '#a89c84', 13); txt(owned ? 'owned' : shopPrice(e) + ' ' + GAME.currency.id, x + w - 22, yy, owned ? '#6a6250' : '#f0c860', 12, 'right');
    if (on) cursor(x + 22, yy + 1);
  });
  const ly = y + 42 + Shop.list.length * 26; const on = Shop.sel === Shop.list.length;
  txt('Leave', x + 42, ly, on ? '#fff' : '#a89c84', 13); if (on) cursor(x + 22, ly + 1);
  win(408, 16, 216, 70); txt(GAME.currency.label, 424, 26, '#8a7e66', 10); txt(String(G.hero.mon), 606, 40, '#f0c860', 18, 'right');
  const sur = shopSurcharge(); if (sur && sur.label) txt(sur.label, 424, 66, '#e07050', 10);
  const e = Shop.list[Shop.sel];
  win(16, 290, 608, 56);
  if (Shop.msgT > 0) txt(Shop.msg, 32, 306, '#f6e4b0', 13);
  else if (e) {
    let d = e.d.desc || ''; if (e.t === 'w') d = `Attack +${e.d.atk} (yours: +${gearDef('w', G.hero.weapon).atk}). ` + d; if (e.t === 'a') d = `Defense +${e.d.def} (yours: +${gearDef('a', G.hero.armor).def}). ` + d;
    if (e.t === 'i') d += `   You have ${G.inv[e.id] || 0}.`;
    wrap(d, 580, 12).slice(0, 2).forEach((l, i) => txt(l, 32, 300 + i * 18, '#f4ecd8', 12));
  } else txt('Come again!', 32, 306, '#f4ecd8', 13);
}
// Job fw-F2: the shop is an overlay: render() draws the mode it opened from, then this on top
defineMode('shop', { base: () => Shop.prev, update: () => shopUpdate(), overlay: () => drawShop() });
