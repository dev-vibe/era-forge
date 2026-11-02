// ============================================================
//  The pause menu (core/ui; job fw-F3b, 28 Oct 2026: the menu page registry)
//  The menu draws the left-hand column of pages, the party member's stat block, the open page's panel and the footer; it names no
//  page of its own. The pages come from MENU_PAGES (01a_game.js, section 6): the game registers the ones it wants (a game's content file),
//  mostly stock pages the systems offer in MENU_STOCK (items and equip: 05_items.js; techniques and party: 05_party.js; keepsakes:
//  05_bonds.js; chronicle: 05_chronicle.js; settings: 07c_settings.js; status, save and close: here).
//  Menu.tab is the open page's id (null: the left-hand column has the cursor); Menu.sel the cursor in that column; Menu.sub the cursor
//  in the page's list; Menu.who the party member shown; Menu.pick the member being chosen for an item or a healing technique.
//  The shop moved to the items system (05_items.js).
// ============================================================
// Job fw-F2: the current objective is the game's story (GAME_HOOKS.aim)
const aim = () => gameHook('aim') || '';
const menuOpts = () => menuPages().map(p => p.label);   // the labels in the left-hand column, in order
const Menu = { sel: 0, tab: null, sub: 0, msg: '', msgT: 0, prev: 'field', who: 0, pick: null };
function openMenu() { Menu.prev = G.state; G.state = 'menu'; Menu.sel = 0; Menu.tab = null; Menu.msg = ''; Menu.who = 0; Menu.pick = null; sfx('ok'); }
function closeMenu() { G.state = Menu.prev; sfx('back'); }
const menuMember = () => partyAll()[Menu.who] || G.hero;
function menuMsg(s) { Menu.msg = s; Menu.msgT = 120; }
// the page whose panel shows while no page is open (e.g. Status)
const menuHome = () => menuPageList().find(p => p.home) || null;

function menuUpdate() {
  if (Menu.msgT > 0) Menu.msgT--;
  const pages = menuPages(), all = partyAll();
  if (Menu.pick) {   // choosing who gets the item or the healing
    if (nav('up') || nav('left')) { Menu.pick.i = (Menu.pick.i + all.length - 1) % all.length; sfx('cursor'); }
    if (nav('down') || nav('right')) { Menu.pick.i = (Menu.pick.i + 1) % all.length; sfx('cursor'); }
    if (btn('b')) { Menu.pick = null; sfx('back'); return; }
    if (btn('a')) menuPickDo(all[Menu.pick.i]);
    return;
  }
  if (!Menu.tab) {
    if (nav('up')) { Menu.sel = (Menu.sel + pages.length - 1) % pages.length; sfx('cursor'); }
    if (nav('down')) { Menu.sel = (Menu.sel + 1) % pages.length; sfx('cursor'); }
    if (all.length > 1 && (nav('left') || nav('right'))) { Menu.who = (Menu.who + (nav('left') ? all.length - 1 : 1)) % all.length; sfx('cursor'); }
    if (btn('b') || btn('start')) return closeMenu();
    if (btn('a')) {
      const pg = pages[Menu.sel]; if (!pg) return;
      if (pg.pick && pg.pick() === false) return;   // Save, Close, or a page that refuses (Equip for a companion)
      Menu.tab = pg.id; Menu.sub = 0; sfx('ok');
    }
    return;
  }
  const pg = menuPage(Menu.tab);
  if (!pg) { Menu.tab = null; return; }   // a page the game dropped while it was open
  if (pg.input) { if (btn('b')) { Menu.tab = null; sfx('back'); return; } return pg.input(); }   // a custom page (Settings)
  const m = menuMember();
  if (pg.members && all.length > 1 && (nav('left') || nav('right'))) { Menu.who = (Menu.who + (nav('left') ? all.length - 1 : 1)) % all.length; Menu.sub = 0; sfx('cursor'); }
  if (pg.turn && (nav('left') || nav('right'))) { pg.turn(nav('left') ? -1 : 1); Menu.sub = 0; sfx('cursor'); }
  const list = pg.list ? pg.list(menuMember()) : [];
  if (btn('b')) { Menu.tab = null; sfx('back'); return; }
  if (list.length) {
    if (pg.right && nav('right')) { pg.right(list[Math.min(Menu.sub, list.length - 1)], m); return; }
    if (nav('up')) { Menu.sub = (Menu.sub + list.length - 1) % list.length; sfx('cursor'); }
    if (nav('down')) { Menu.sub = (Menu.sub + 1) % list.length; sfx('cursor'); }
    Menu.sub = Math.min(Menu.sub, list.length - 1);
  }
  if (btn('a') && list.length && pg.use) pg.use(list[Menu.sub], m);
}
function drawStatBlock(x, y, m = G.hero) {
  const h = G.hero, s = memberStats(m), nm = memberName(m), pim = m === G.hero ? portrait(HERO_SPR) : assetImg('portrait_' + allyDef(m.id).cast);
  X.imageSmoothingEnabled = false; if (pim) X.drawImage(pim, x * S, (y - 4) * S, 72 * S, 72 * S);
  const tx = x + 84;
  txt(nm, tx, y, '#f6d890', 16); txt('Lv ' + h.lv, tx + 120, y + 3, '#f4ecd8', 12);
  txt('HP', tx, y + 26, '#a89c84', 11); txt(`${m.hp} / ${s.maxHp}`, tx + 150, y + 24, '#f4ecd8', 12, 'right'); gauge(tx, y + 40, 150, m.hp, s.maxHp, '#e0604a');
  txt('Ki', tx, y + 48, '#a89c84', 11); txt(`${m.ki} / ${s.maxKi}`, tx + 150, y + 46, '#f4ecd8', 12, 'right'); gauge(tx, y + 62, 150, m.ki, s.maxKi, '#5aa8e0');
  const cx = tx + 180;
  [['Attack', s.atk], ['Defense', s.def], ['Speed', s.spd]].forEach(([k, v], i) => { txt(k, cx, y + 2 + i * 20, '#a89c84', 11); txt(String(v), cx + 110, y + i * 20, '#f4ecd8', 13, 'right'); });
  txt(GAME.currency.label, cx, y + 62, '#a89c84', 11); txt(String(h.mon), cx + 110, y + 60, '#f0c860', 13, 'right');
  if (partyAll().length > 1) txt('◀ ▶', x + 418, y - 4, '#8a7e66', 10, 'right');
}
function drawMenu() {
  X.fillStyle = 'rgba(12,8,6,.5)'; X.fillRect(0, 0, W * S, H * S);
  const pages = menuPages(), n = pages.length, y0 = n > 8 ? 30 : n > 7 ? 38 : 46, st = Math.min(26, (186 - y0) / Math.max(1, n - 1));   // the spacing shrinks to fit the panel (up to 10 entries; the last row clears the panel's edge)
  win(16, 16, 150, 196);
  uiStamp(132, 22, 20, GAME.seal[0], 0.04);
  pages.forEach((p, i) => { const on = Menu.sel === i, y = y0 + i * st; if (on) selBar(26, y - 3, 128, 20); txt(p.label, 46, y, on ? '#fff' : '#a89c84', 14); if (on && !Menu.tab) cursor(28, y + 1); });
  win(16, 220, 150, 62);
  txt('Where', 28, 228, '#8a7e66', 10); txt(Menu.prev === 'world' ? GAME.world.name : (G.map ? G.map.name : Menu.prev === 'scene' && SC.def ? SC.def.name || '' : ''), 28, 241, '#f4ecd8', 11);
  txt(bondsDate() || GAME.calendar.start, 28, 260, '#c8b890', 10);   // set by the last date card (05_bonds.js)
  const all = partyAll(), m = menuMember();
  win(176, 16, 448, 96); drawStatBlock(190, 28, Menu.pick ? all[Menu.pick.i] : m);
  const px = 176, py = 120, pw = 448, ph = 162;
  win(px, py, pw, ph);
  const pg = Menu.tab ? menuPage(Menu.tab) : menuHome();
  if (Menu.pick) {
    const pk = Menu.pick, what = pk.kind === 'item' ? contentGet('items', pk.id).name : `${memberName(pk.m)}: ${contentGet('techniques', pk.id).name}`;
    txt(`${what} — for whom?`, px + 18, py + 12, '#f6d890', 13);
    all.forEach((x, i) => {
      const y = py + 38 + i * 23, on = i === pk.i, s = memberStats(x);
      if (on) selBar(px + 14, y - 3, pw - 28, 19);
      txt(memberName(x), px + 40, y, on ? '#fff' : '#a89c84', 13); txt(`HP ${x.hp}/${s.maxHp}   Ki ${x.ki}/${s.maxKi}`, px + pw - 22, y, on ? '#f6d890' : '#8a7e66', 12, 'right');
      if (on) cursor(px + 20, y + 1);
    });
  } else if (pg && pg.draw) pg.draw(px, py, pw, ph, m);
  else if (pg) drawMenuList(pg, px, py, pw, m);
  win(16, 290, 608, 56);
  let foot = null;
  if (Menu.msgT > 0) foot = [Menu.msg, '#f6e4b0'];
  else if (Menu.tab && pg && pg.foot) foot = pg.foot(m);
  else if (Menu.tab && pg && pg.info && !Menu.pick) { const it = (pg.list ? pg.list(m) : [])[Menu.sub]; if (it) foot = [pg.info(it, m), '#f4ecd8']; }
  const hz = THEME.sizes.help || 12;   // the help line's size (theme.json sizes.help)
  if (foot) wrap(foot[0], 580 - (hz - 12) * 20, hz).slice(0, 2).forEach((l, i) => txt(l, 32, 300 - (hz - 12) * 2 + i * (hz + 6), foot[1], hz));
  else { txt('Aim', 32, 298, '#f6d890', 10); wrap(aim(), 560, hz).slice(0, 2).forEach((l, i) => txt(l, 32, 312 + i * (hz + 4), '#f4ecd8', hz)); }
}
// a list page: its title, up to five rows around the cursor (row(it) -> { name, right, icon?, thumb?(x, y), fit? })
function drawMenuList(pg, px, py, pw, m) {
  const list = pg.list ? pg.list(m) : [];
  txt(pg.title ? pg.title(m) : pg.label, px + 18, py + 12, '#f6d890', 13);
  if (pg.head) txt(pg.head(), px + pw - 22, py + 12, '#8a7e66', 10, 'right');
  if (!list.length) txt('Nothing yet.', px + 18, py + 40, '#8a7e66', 12);
  const vis = 5, start = clamp(Menu.sub - 2, 0, Math.max(0, list.length - vis));
  list.slice(start, start + vis).forEach((it, k) => {
    const i = start + k, y = py + 38 + k * 23, on = i === Menu.sub, r = pg.row(it, m, i);
    let name = r.name; const right = r.right == null ? '' : r.right;
    if (on) selBar(px + 14, y - 3, pw - 28, 19);
    if (r.icon) itemIcon(r.icon, px + 37, y - 4, 22);
    if (r.thumb) r.thumb(px + 37, y - 4);
    const nx = px + (r.icon || r.thumb ? 64 : 40);
    if (r.fit) {   // a long name is cut to fit beside the right-hand text
      const max = px + pw - 32 - txtW(right, 12) - nx;
      while (txtW(name, 13) > max && name.length > 1) name = name.replace(/…$/, '').slice(0, -1) + '…';
    }
    txt(name, nx, y, on ? '#fff' : '#a89c84', 13); txt(right, px + pw - 22, y, on ? '#f6d890' : '#8a7e66', 12, 'right');
    if (on) cursor(px + 20, y + 1);
  });
}

// ---------------- the core's stock pages ----------------
// Status: the hero's journey (gear, experience, techniques) or a companion's role, place in the line, bond and techniques
function drawStatusPage(px, py, pw, ph, m) {
  const h = G.hero, W_ = id => contentGet('weapons', id), A_ = id => contentGet('armors', id), T_ = id => contentGet('techniques', id).name;
  txt(m === h ? 'Journey' : memberName(m), px + 18, py + 12, '#f6d890', 13);
  const rows = m === h
    ? [['Weapon', W_(h.weapon).name + '  (Atk +' + W_(h.weapon).atk + ')'], ['Armor', A_(h.armor).name + '  (Def +' + A_(h.armor).def + ')'], ['Experience', String(h.xp)], ['To next level', String(Math.max(0, xpToReach(h.lv + 1) - h.xp))], ['Techniques', h.techs.map(T_).join(', ')]]
    : [['Role', allyDef(m.id).role], ['Weapon', allyDef(m.id).weapon], ['In battle', (G.active || []).includes(m.id) ? 'Fights beside ' + GAME.hero.name : 'In reserve'], ['Level', 'Shares ' + GAME.hero.name + '\'s level'], ['Bond', bondWord(m.id)], ['Techniques', m.techs.map(T_).join(', ')]];
  const rh = rows.length > 5 ? 20 : 23;
  rows.forEach(([k, v], i) => { txt(k, px + 18, py + 38 + i * rh, '#a89c84', 11); txt(v, px + 140, py + 36 + i * rh, '#f4ecd8', 12); });
}
MENU_STOCK.status = { label: 'Status', home: true, members: true, draw: drawStatusPage };
MENU_STOCK.save = { label: 'Save', pick: () => { const ok = writeSave(saveData()); sfx(ok ? 'ok' : 'deny'); menuMsg(ok ? 'Your journey has been recorded.' : 'This browser would not let the game save.'); return false; } };
MENU_STOCK.close = { label: 'Close', pick: () => { closeMenu(); return false; } };

// Job fw-F2: the pause menu is an overlay: render() draws the mode it opened from, then this on top (the shop: 05_items.js)
defineMode('menu', { base: () => Menu.prev, update: () => menuUpdate(), overlay: () => drawMenu() });
