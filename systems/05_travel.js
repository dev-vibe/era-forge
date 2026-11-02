// ============================================================
//  The travel system (job fw-F3c, 28 Oct 2026; systems/travel; plan: the framework plan, "Target shape")
//  Genre-neutral: this file names no place, person, picture, track or story flag. The game supplies all of them as data:
//
//  THE MAP ('world' mode). content('locations'): a list of places
//      { id, name, jp, year, blurb,
//        req,       unlock condition: a G.f flag name, a function (flags) => bool, or a list of conditions (all must hold); none = open
//        built,     true when the place can be entered (otherwise game.json world.notBuilt is shown)
//        entry,     { scene, at: [x, y, dir], map: [mapId, x, y, dir] }: the painted scene, else the tile map, entered from the map
//        route,     a journey id: choosing the place offers that journey while it can start (below)
//        notice }   { flag, lines }: a script shown once, the first time the map opens with the place unlocked (it is then selected)
//    content('atlas'): the map's look { links: [[a, b]...], xy(l) -> [x, y], cleared(l), back(), node(l, state, x, y), hero(),
//      mark(x, y), front(), stamps: { cleared, active, soon, locked } -> [label, colour] }. game.json world: name, era, music, sealed, notBuilt.
//  THE ROAD ('road' mode). content('routes'): journeys made of stations (stops) and legs (travel between them), by id
//      { version,      a journey saved with another version starts again
//        stations,     [{ id, name, at: [x, y] (0..1 on the map art), art, next, day, night, branch, departLabel, onLeave() -> steps | null,
//                       seals: [{ id, name, who, at, when(), lines() | rest: true | use() }] }]
//        legs,         { <from>: { to, frames, scene, branches: { <branch value>: leg } } }   (scene: a walking leg in a painted scene)
//        start, music, map (map art), requiredArt (asset ids the journey needs), title, dateLabel(day), dayCard(day), sealGlyphs,
//        canStart, autoStart (conditions, as for req), ask: { q, yes, no } (offered from the map), onStart(), intro(),
//        branch() -> the branch value chosen so far, night(station, n) -> the rest steps (they call roadRested(n)),
//        resume: { <pending kind>: fn(pending) }, drawStop(station), drawOverlay(progress), speakerAlias, text }
//      text: { again, againAlone, restDone, checkpoint, walkNext } ('{hero}' is the hero's name).
//  STATE (saved): the travel namespace, sysState('travel') (01c_save.js):
//      { map: { sel, at },                     the map cursor and the place the hero stands (G.worldSel, G.lastLoc read these)
//        journey,                              the journey under way: { route, version, station, mode, sel, visited, leg, pending,
//                                              talk, walkAt, transition, day, duel } (everything needed to resume after a reload)
//        routes: { <id>: { done, seen, nights, mornings } } }   per journey: finished, seals heard, nights rested, day cards shown
// ============================================================
const travelInit = () => ({ map: { sel: GAME.start.location, at: GAME.start.location }, journey: null, routes: {} });
const travelState = () => sysState('travel');
for (const [k, key] of [['worldSel', 'sel'], ['lastLoc', 'at']])
  Object.defineProperty(G, k, { get: () => travelState().map[key], set: v => { travelState().map[key] = v; }, configurable: true });
// A condition: nothing (always), a G.f flag name, a function of the flags, or a list (all of them).
function travelCond(c) { if (c == null) return true; if (typeof c === 'function') return !!c(G.f); if (Array.isArray(c)) return c.every(travelCond); return !!G.f[c]; }

// ---------------- The map ----------------
const travelLocs = () => content('locations');
const travelAtlas = () => content('atlas');
const locById = id => travelLocs().find(l => l.id === id);
const locOpen = l => travelCond(l.req);
const locXY = l => travelAtlas().xy(l);
function openWorld(skipRoad = false) {
  if (!skipRoad) { const id = Object.keys(travelRoutes()).find(id => roadCanStart(id) && travelCond(travelRoute(id).autoStart)); if (id) { startRoad(id); return; } }
  G.state = 'world'; G.map = null; playMusic(GAME.world.music); G.worldInfo = 0;
  const l = travelLocs().find(l => l.notice && locOpen(l) && !G.f[l.notice.flag]);
  if (l) { G.f[l.notice.flag] = 1; G.worldSel = l.id; run(l.notice.lines); }
}
function travelEnter(l) {
  const e = l.entry || {}, sc = e.scene && SCENES[e.scene];
  if (sc && assetImg(sc.img)) enterScene(e.scene, e.at); else if (e.map) enterMap(...e.map);
}
function worldUpdate() {
  if (Script.active) return;
  if (btn('start')) { openMenu(); return; }
  const cur = locById(G.worldSel), locs = travelLocs();
  const [cx, cy] = locXY(cur);
  const dirs = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  for (const k in dirs) if (nav(k)) {
    const [vx, vy] = dirs[k]; let best = null, bs = 1e9;
    for (const l of locs) { if (l === cur) continue; const [lx, ly] = locXY(l), dx = lx - cx, dy = ly - cy, dist = Math.hypot(dx, dy); const cos = (dx * vx + dy * vy) / dist; if (cos < 0.3) continue; const sc = dist * (1.6 - cos); if (sc < bs) { bs = sc; best = l; } }
    if (best) { G.worldSel = best.id; sfx('cursor'); }
  }
  if (btn('a')) {
    const l = cur, say = s => gameText(s, { place: l.name, year: l.year });
    if (!locOpen(l)) { sfx('deny'); run([['', say(GAME.world.sealed)]]); return; }
    if (l.route && roadCanStart(l.route)) {
      const ask = travelRoute(l.route).ask;
      run([{ ask: ask.q, opts: [ask.yes, ask.no], then: [[() => warp(() => startRoad(l.route))], []] }]); return;
    }
    if (!l.built) { sfx('deny'); run([['', say(GAME.world.notBuilt)]]); return; }
    sfx('ok'); G.lastLoc = l.id;
    warp(() => travelEnter(l));
  }
}
// A place's state: cleared (the game's own test, e.g. liberated), open, or locked.
const locState = l => travelAtlas().cleared(l) ? 'cleared' : locOpen(l) ? 'open' : 'locked';
function drawWorld() {
  const A = travelAtlas(), locs = travelLocs(), at = l => locXY(l).map(Math.round);
  A.back();
  for (const [a, b] of A.links) {
    const [x1, y1] = locXY(locById(a)), [x2, y2] = locXY(locById(b));
    const n = Math.max(2, Math.floor(Math.hypot(x2 - x1, y2 - y1) / 4)), open = locOpen(locById(b));
    for (let i = 1; i < n; i++) { if (i % 2) continue; const x = Math.round(x1 + (x2 - x1) * i / n), y = Math.round(y1 + (y2 - y1) * i / n); L.fillStyle = open ? '#fff4d8' : 'rgba(40,30,20,.5)'; L.fillRect(x, y, 2, 2); if (open) { L.fillStyle = 'rgba(0,0,0,.3)'; L.fillRect(x + 1, y + 2, 2, 1); } }
  }
  for (const l of locs) {
    const [x, y] = at(l), sel = l.id === G.worldSel, st = locState(l);
    if (sel) { L.globalCompositeOperation = 'lighter'; L.globalAlpha = 0.5 + Math.sin(frame / 8) * 0.2; L.drawImage(glowSprite(18, st === 'locked' ? '#8080a0' : '#ffc070'), x - 18, y - 22); L.globalAlpha = 1; L.globalCompositeOperation = 'source-over'; }
    L.drawImage(shadowSprite(18, 6), x - 9, y - 1);
    A.node(l, st, x, y);
  }
  // the hero, small, standing just above his current place so he never hides a neighbouring node
  const hs = A.hero(), [hmx, hmy] = at(locById(G.lastLoc));
  L.drawImage(shadowSprite(12, 4), hmx + 6, hmy - 20); L.drawImage(hs, hmx + 12 - (hs.width >> 1), hmy - 18 - hs.height);
  // newly opened places bob a marker
  for (const l of locs) { if (!locOpen(l) || A.cleared(l) || l.id === G.lastLoc) continue; const [x, y] = at(l); A.mark(x, y - 24 + Math.round(Math.sin(frame / 8) * 2)); }
  A.front();
}
function drawWorldUI() {
  const A = travelAtlas(), l = locById(G.worldSel), open = locOpen(l);
  win(12, 12, 200, 336);
  txt(GAME.world.name, 28, 24, '#8a7e66', 10); txt(GAME.world.era, 196, 24, '#8a7e66', 10, 'right');
  X.fillStyle = 'rgba(214,176,104,.35)'; X.fillRect(28 * S, 40 * S, 168 * S, 1);
  txt(l.name, 28, 50, '#f6d890', 20); txt(l.jp, 196, 54, '#d8ccb0', 14, 'right');
  txt(l.year, 28, 78, '#c8b890', 12);
  const status = A.stamps[A.cleared(l) ? 'cleared' : open ? (l.built ? 'active' : 'soon') : 'locked'];
  X.font = `700 ${Math.round(10 * S)}px ${FONT_HEAD}`; const sw = X.measureText(status[0]).width / S + 20; X.save(); X.translate((28 + sw / 2) * S, 107 * S); X.rotate(-0.03); X.fillStyle = status[1]; X.globalAlpha = 0.9; X.fillRect(-sw / 2 * S, -9 * S, sw * S, 18 * S); X.strokeStyle = UI.cream; X.globalAlpha = 0.7; X.lineWidth = S; X.strokeRect((-sw / 2 + 2) * S, -7 * S, (sw - 4) * S, 14 * S); X.restore(); X.font = `700 ${Math.round(10 * S)}px ${FONT_HEAD}`; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillStyle = UI.cream; X.fillText(status[0], (28 + sw / 2) * S, 107 * S); X.textAlign = 'left'; X.textBaseline = 'top';
  wrap(l.blurb, 168, 12).forEach((ln, i) => txt(ln, 28, 128 + i * 19, '#f4ecd8', 12));
  if (open && l.built) txt('{a} Travel here', 28, 322, '#f6d890', 12);
  else txt('{move}: choose a place', 28, 322, '#8a7e66', 11);
  const [nx, ny] = locXY(l), tw = txtW(l.name, 11) + 16;
  const tx = clamp(nx - tw / 2, 220, W - tw - 4), ty = ny + 8;
  win(tx, ty, tw, 18); txt(l.name, tx + tw / 2, ty + 3, '#fff', 11, 'center');
}

// ---------------- The road: journeys between stations ----------------
const Road = { t: 0, note: '', fade: null };
const travelRoutes = () => content('routes');
const travelRoute = id => travelRoutes()[id];
const roadState = () => travelState().journey;
const roadRoute = () => { const r = roadState(); return r && travelRoute(r.route); };
const roadDefault = () => roadState()?.route || Object.keys(travelRoutes())[0];
const roadMem = (id = roadState().route) => { const t = travelState(); return t.routes[id] || (t.routes[id] = { done: 0, seen: {}, nights: {}, mornings: {} }); };
const roadDone = id => !!(travelState().routes[id] || {}).done;
const roadStationById = id => roadRoute().stations.find(s => s.id === id);
const roadStation = () => roadStationById(roadState().station);
const roadDay = () => roadState().day || roadStation().day || 1;
const roadSeals = (s = roadStation()) => (s.seals || []).filter(h => !h.when || h.when());
const roadBranch = () => { const r = roadRoute(); return r && r.branch ? r.branch() : null; };
const roadOnBranch = s => !s.branch || s.branch === roadBranch();
const roadLegInfo = from => { const leg = roadRoute().legs[from]; return (leg && leg.branches && leg.branches[roadBranch()]) || leg; };
const roadText = k => gameText((roadRoute().text || {})[k]);
// Seals heard at each station (a station's rest seal is marked when the night is spent).
const roadSealKey = id => roadState().station + '_' + id;
const roadSeen = id => !!roadMem().seen[roadSealKey(id)];
function roadMarkSeen(id) { roadMem().seen[roadSealKey(id)] = 1; }
function roadReady(id = roadDefault()) { const r = travelRoute(id); return !!r && (r.requiredArt || []).every(a => !!assetImg(a)); }
function roadCanStart(id) { const r = travelRoute(id); return !!r && travelCond(r.canStart) && !roadDone(id) && roadReady(id); }
function roadRememberWalk() { const r = roadState(); if (r && G.state === 'scene' && SC.id === roadLegInfo(r.leg?.from)?.scene) r.walkAt = [SC.hero.x / SC.k, SC.hero.y / SC.k, SC.hero.dir]; }
function roadRun(steps, pending) { const r = roadState(); roadRememberWalk(); r.pending = pending; Road.note = ''; run(steps, () => { r.pending = null; r.talk = null; Road.t = 0; }); }
function startRoad(id = roadDefault()) {
  const route = travelRoute(id), t = travelState();
  if (!roadReady(id)) { openWorld(true); return; }
  if (!t.journey || t.journey.route !== id || t.journey.version !== route.version)
    t.journey = { route: id, version: route.version, station: route.start, mode: 'map', sel: 0, visited: [route.start], leg: null, pending: null, talk: null };
  const r = t.journey;
  if (r.mode === 'checkpoint' && route.legs[r.station]) r.mode = 'stop';
  if (route.onStart) route.onStart();
  G.state = 'road'; G.map = null; G.mapId = null; G.talkSpr = null; Road.t = 0; Road.note = ''; Road.fade = null; playMusic(route.music);
  if (r.mode === 'walk') {
    const sid = roadLegInfo(r.leg?.from || r.station)?.scene;
    if (sid && SCENES[sid]) { if (SC.id !== sid || !SC.hero) enterScene(sid, r.walkAt || null); else G.state = 'scene'; }
    if (r.transition) roadContinueTransition();
    else if (r.pending) roadResume(); return;
  }
  if (r.transition) roadContinueTransition();
  else if (r.pending) roadResume();
  else if (route.intro) route.intro();
}
// A reload restarts the named beat that was under way (the game's own kinds come from route.resume).
function roadResume() {
  const p = roadState().pending; if (!p) return;
  if (p.kind === 'seal') return roadUseSeal(p.id);
  if (p.kind === 'depart') return roadDepart();
  if (p.kind === 'night' || p.kind === 'night_done') return roadNight();
  if (p.kind === 'morning') return roadRun(roadMorningSteps(p.day), p);
  const f = (roadRoute().resume || {})[p.kind]; if (f) f(p);
}
function roadUseSeal(id) {
  const r = roadState(), s = roadStation(), h = roadSeals(s).find(h => h.id === id);
  if (!h || r.mode !== 'stop') return;
  if (h.use) { h.use(h); return; }
  if (h.rest) { roadNight(); return; }
  const key = roadSealKey(id);
  roadRun(roadMem().seen[key] ? [[h.who || '', h.who ? roadText('again') : roadText('againAlone')]] :
    [...h.lines(), () => { roadMem().seen[key] = 1; sfx('stamp'); }], { kind: 'seal', id });
}
function roadDepart() {
  const s = roadStation(), missing = roadSeals(s).filter(h => !roadSeen(h.id)).map(h => h.name);
  const warn = missing.length ? 'Leaving closes: ' + missing.join(', ') + '.' : 'You have finished here.';
  roadRun([{ ask: warn + '\nSet out for ' + s.next + '?', opts: ['Set out', 'Stay here'], then: [
    [() => roadLeave()], []] }], { kind: 'depart' });
}
// Leaving a station: its night first (if it has one and it is not spent), then the station's own beat, then the next leg.
function roadLeave() {
  const r = roadState(), s = roadStation(), night = s.night || 0;
  if (night && !roadMem().nights[night]) return [...roadNightSteps(), () => roadLeave()];
  if (s.onLeave) { const steps = s.onLeave(); if (steps) return steps; }
  if (!roadRoute().legs[r.station]) { r.mode = 'checkpoint'; return []; }
  roadBeginLeg(); return [];
}
function roadMorningSteps(day) { return [
  () => { roadState().day = day; roadState().pending = { kind: 'morning', day }; },
  { card: [roadRoute().dayCard(day)] }, () => { roadMem().mornings[day] = 1; roadBeginLeg(); }
]; }
function roadNightSteps() { const s = roadStation(); return roadRoute().night(s, s.night || 1); }
// The game's night steps call this where the rest takes effect.
function roadRested(night) { const h = (roadStation().seals || []).find(h => h.rest); roadMem().nights[night] = 1; roadMarkSeen(h ? h.id : 'night'); }
function roadNight() {
  if (roadMem().nights[roadStation().night || 1]) { roadRun([['', roadText('restDone')]], { kind: 'night_done' }); return; }
  roadRun(roadNightSteps(), { kind: 'night' });
}
function roadComplete() { roadMem().done = 1; roadState().mode = 'complete'; }
function roadBeginLeg() { const r = roadState(), leg = roadLegInfo(r.station); if (!leg) return; r.mode = 'map'; r.sel = 0; r.leg = { from: r.station, to: leg.to, progress: 0 }; r.walkAt = null; }
function roadArrive() {
  const r = roadState(), leg = roadLegInfo(r.leg.from);
  if (leg.scene) { roadTransition('walk', SCENES[leg.scene].name); return; }
  roadFinishLeg();
}
function roadFinishLeg() {
  const r = roadState(); if (!r.leg) return;
  roadRememberWalk(); roadTransition('stop', roadStationById(r.leg.to).name);
}
// Exchange the scene at full black; the destination and commit bit survive snapshots.
function roadTransition(to, label) {
  const r = roadState(); if (r.transition) return;
  r.transition = { to, label, committed: false }; roadContinueTransition();
}
function roadContinueTransition() { const committed = roadState().transition.committed; Road.fade = { age: committed ? 48 : 0, alpha: committed ? 1 : 0 }; }
function roadTickTransition() {
  const r = roadState(); if (!r?.transition || !Road.fade) return false;
  const f = Road.fade, t = r.transition; f.age++;
  f.alpha = f.age <= 36 ? f.age / 36 : f.age <= 60 ? 1 : Math.max(0, 1 - (f.age - 60) / 36);
  if (f.age >= 36 && !t.committed) {
    t.committed = true;
    if (t.to === 'walk') { r.mode = 'walk'; enterScene(roadLegInfo(r.leg.from).scene); }
    else roadCommitStop();
  }
  if (f.age >= 96) { delete r.transition; Road.fade = null; Road.t = 0; }
  return true;
}
function drawRoadTransition() {
  const f = Road.fade, t = roadState()?.transition; if (!f || !t) return;
  X.fillStyle = 'rgba(0,0,0,' + f.alpha + ')'; X.fillRect(0, 0, W * S, H * S);
  X.globalAlpha = Math.max(0, (f.alpha - .65) / .35); headTxt(t.label, W / 2, H / 2 - 7, UI.cream, 22, 'center', 600); X.globalAlpha = 1;
}
function roadCommitStop() {
  const r = roadState(); r.station = r.leg.to;
  if (!r.visited.includes(r.station)) r.visited.push(r.station);
  r.leg = null; r.mode = 'stop'; r.sel = 0; r.pending = null; G.state = 'road'; G.map = null; G.mapId = null; Road.t = 0; playMusic(roadRoute().music);
}
function roadRestore() {
  const r = roadState(); if (!r) return false;
  Script.active = false; Script.queue = []; Script.done = null; Dialog.active = false; G.card = null; G.stamp = null;
  if (r.transition) { startRoad(); return true; }
  if (r.mode === 'walk') { const id = roadLegInfo(r.leg?.from || r.station)?.scene; if (SC.id !== id) { startRoad(); return true; } if (r.pending) roadResume(); return true; }
  startRoad(); return true;
}
function roadUpdate() {
  Road.t++; if (Script.active) { if (ST.wait > 0 && --ST.wait === 0) nextStep(); return; }   // Job 18d: a { wait } inside a close-up beat (insShow, 05l) counts down in the road state too
  if (btn('start')) { openMenu(); return; }
  const r = roadState(), s = roadStation();
  if (r.mode === 'map' && r.leg) { r.leg.progress = Math.min(1, r.leg.progress + 1 / roadLegInfo(r.leg.from).frames); if (r.leg.progress >= 1) roadArrive(); return; }
  if (r.mode === 'map') { if (btn('a')) roadBeginLeg(); return; }
  if (r.mode === 'checkpoint') return;
  const seals = roadSeals(s), n = seals.length + 1; r.sel = Math.min(r.sel, n - 1);
  if (nav('up') || nav('left')) { r.sel = (r.sel + n - 1) % n; sfx('cursor'); }
  if (nav('down') || nav('right')) { r.sel = (r.sel + 1) % n; sfx('cursor'); }
  if (Road.t > 10 && btn('a')) r.sel < seals.length ? roadUseSeal(seals[r.sel].id) : roadDepart();
}
function roadDrawImage(id) { const im = assetImg(id); L.fillStyle = '#e4d0a0'; L.fillRect(0, 0, W, H); if (im) L.drawImage(im, 0, 0, W, H); }
function drawRoad() {
  const r = roadState(), s = roadStation(), route = roadRoute();
  roadDrawImage(r.mode === 'stop' ? s.art : route.map);
  if (r.mode === 'stop') { if (route.drawStop) route.drawStop(s); if (ST.dim > 0) { L.fillStyle = 'rgba(8,8,16,' + ST.dim + ')'; L.fillRect(0, 0, W, H); } return; }
  if (route.drawOverlay) route.drawOverlay(r.visited.length + (r.leg ? r.leg.progress : 0));
  const stations = route.stations.filter(roadOnBranch);
  L.beginPath(); stations.forEach((s, i) => i ? L.lineTo(s.at[0] * W, s.at[1] * H) : L.moveTo(s.at[0] * W, s.at[1] * H));
  L.lineWidth = 5; L.strokeStyle = '#30271e'; L.stroke(); L.lineWidth = 2; L.strokeStyle = '#fff0c1'; L.stroke();
  stations.forEach(s => { L.fillStyle = r.visited.includes(s.id) ? '#c9432f' : '#665340'; L.beginPath(); L.arc(s.at[0] * W, s.at[1] * H, 3, 0, Math.PI * 2); L.fill(); });
  const a = roadStationById(r.leg ? r.leg.from : r.station).at, b = roadStationById(r.leg ? r.leg.to : r.station).at, t = r.leg ? r.leg.progress : 0;
  const mx = (a[0] + (b[0] - a[0]) * t) * W, my = (a[1] + (b[1] - a[1]) * t) * H;
  // A map pin is UI: its point stays on the route, while the pale backing separates the sheet from the busy painting.
  L.fillStyle = '#f6e6c3'; L.strokeStyle = '#2e211b'; L.lineWidth = 2; L.beginPath(); L.arc(mx, my - 21, 23, 0, Math.PI * 2); L.fill(); L.stroke();
  L.strokeStyle = '#b63d2c'; L.lineWidth = 2; L.beginPath(); L.arc(mx, my - 21, 26 + Math.sin(Road.t / 20) * 1.5, 0, Math.PI * 2); L.stroke();
  L.fillStyle = '#b63d2c'; L.beginPath(); L.moveTo(mx - 5, my - 2); L.lineTo(mx, my + 5); L.lineTo(mx + 5, my - 2); L.fill();
  const spr = castSprite(heroCastId(), 2, r.leg ? [0, 1, 0, 3][Math.floor(Road.t / 10) % 4] : 0);
  if (spr) L.drawImage(spr, mx - 17, my - 42, 34, 40);
  Road.marker = { x: mx, y: my };
}
function roadWrap(body, x, y, width, size, color = UI.ink) { wrap(body, width, size).forEach((ln, i) => txt(ln, x, y + i * (size + 5), color, size)); }
function drawRoadUI() {
  const r = roadState(), s = roadStation(), route = roadRoute(), day = roadDay(), legTo = from => roadStationById(roadLegInfo(from)?.to)?.name || '';
  const glyph = route.sealGlyphs || ['', ''];
  win(18, 14, 604, 44); txt(r.mode === 'stop' ? s.name : route.title, 32, 22, UI.ink, 18); txt(route.dateLabel(day), 606, 24, '#725843', 10, 'right'); txt('Next: ' + (s.next || legTo(s.id)), 33, 44, '#725843', 10);
  if (r.mode === 'stop') {
    const seals = roadSeals(s); seals.forEach((h, i) => { const x = h.at[0] * W, y = h.at[1] * H; uiStamp(x, y, i === r.sel ? 26 : 22, roadSeen(h.id) ? glyph[1] : glyph[0]);
      if (i === r.sel && !Dialog.active) { const w = Math.min(230, txtW(h.name, 12) + 22); win(x - w / 2, y + 18, w, 25); txt(h.name, x, y + 24, UI.ink, 12, 'center'); }
    });
    win(18, 296, 604, 50); if (r.sel === seals.length) cursor(30, 310); txt(s.departLabel || 'Set out for ' + s.next, 48, 305, r.sel === seals.length ? UI.seal : UI.ink, 14); txt('{move}: seals or departure    {a} Choose    {start} Menu', 34, 329, '#725843', 10); return;
  }
  if (Road.marker) { const { x, y } = Road.marker; win(x - 56, y + 10, 112, 22); txt(gameText(r.leg ? '{hero} · travelling' : '{hero} · you are here'), x, y + 16, UI.ink, 10, 'center'); }
  const target = r.leg ? r.leg.to : roadLegInfo(r.station)?.to; win(360, 74, 262, 206);
  route.stations.filter(roadOnBranch).forEach((s, i) => { txt(s.name, 375, 85 + i * 19, r.visited.includes(s.id) ? UI.ink : '#796c57', 10); txt(s.id === r.station ? 'HERE' : s.id === target ? 'NEXT' : r.visited.includes(s.id) ? 'VISITED' : '', 608, 86 + i * 19, s.id === target ? UI.seal : '#796c57', 8, 'right'); });
  win(18, 296, 604, 50); txt(r.mode === 'checkpoint' ? roadText('checkpoint') : r.leg ? 'Travelling to ' + roadStationById(r.leg.to).name : '{a} Set out for ' + legTo(r.station), 32, 305, UI.ink, 13); txt('{start} Menu', 32, 330, '#725843', 10);
}
function drawRoadDialog() {
  const d = Dialog, x = 352, y = 66, w = 270, who = (roadRoute().speakerAlias || {})[d.who] || d.who, p = castPortrait(who) || (d.spr && portrait(d.spr));
  win(x, y, w, 222); if (p) X.drawImage(p, (x + 12) * S, (y + 12) * S, 62 * S, 62 * S); txt(d.who || roadStation().name, x + (p ? 84 : 14), y + 15, UI.seal, 13);
  let left = d.shown, body = ''; for (const ln of d.pages[d.page]) { body += ln.slice(0, Math.max(0, left)) + ' '; left -= ln.length; }
  roadWrap(body, x + 14, y + 86, w - 28, 12);
  const done = d.shown >= d.pages[d.page].join('').length;
  if (done && d.choices && d.page === d.pages.length - 1) { const h = d.choices.length * 24 + 14, cy = Math.max(66, 288 - h); win(16, cy, 326, h); d.choices.forEach((c, i) => { if (i === d.sel) cursor(26, cy + 10 + i * 24); txt(c, 44, cy + 8 + i * 24, i === d.sel ? UI.seal : UI.ink, 11); }); }
  else if (done) moreMark(x + w - 20, y + 204);
}
// The walking legs are painted scenes of the top-down kit; while one is under way it shows where the leg leads.
const roadWalkScene = id => { const r = roadRoute(); return !!r && !!id && Object.values(r.legs).some(l => l.scene === id || Object.values(l.branches || {}).some(b => b.scene === id)); };
function drawRoadWalkUI() {
  if (!roadState() || !roadWalkScene(SC.id)) return;
  win(12, 12, 250, 38); txt(SC.def.name, 24, 20, UI.ink, 12); txt('Next: ' + roadStationById(roadState().leg?.to)?.name + ' · ' + roadText('walkNext'), 24, 37, '#725843', 10);
}

// ---------------- Modes and saves ----------------
defineMode('world', { system: 'travel', update: () => worldUpdate(), art: () => drawWorld(), ui: () => drawWorldUI() });
defineMode('road', { system: 'travel', update: () => roadUpdate(), art: () => drawRoad(), ui: () => { drawRoadUI(); if (typeof drawCine === 'function') drawCine(); } });
defineSaveSpace('travel', {
  init: travelInit,
  battleScene: () => !!roadState(),   // a fight on a walking leg keeps the scene position
  resume: () => {   // a journey between stops (on the map, at a stop, mid-fade) resumes on the road
    const r = roadState(); if (!r || roadDone(r.route)) return false;
    Script.active = false; Script.queue = []; Script.done = null; Dialog.active = false; G.card = null; G.stamp = null;
    if (r.mode !== 'walk') { startRoad(r.route); return true; }
    return false;
  },
  placed: () => { const r = roadState(); if (r && r.mode === 'walk') roadRestore(); },   // a walking leg: back in its scene, its beat resumed
});
