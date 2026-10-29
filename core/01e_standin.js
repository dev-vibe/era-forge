// ============================================================
//  STAND-IN art (job fw-F5a, 29 Oct 2026; gap "fallback art", G12)
//  Charter area 9: every image comes from the ChatGPT app. Until a file lands, a game that sets game.json `standIn: true` gets plain,
//  clearly marked stand-ins from the engine, so a slice plays without art and nothing in the game has to paint its own:
//    char_<id>      a walking sheet (3x3 cells of 84x100), a plain figure coloured from the cast entry's `look` (or from the id)
//    portrait_<id>  a head-and-shoulders card
//    a painting     the image a scene names (SCENES[x].img): drawn from that scene's own JSON geometry, so it can be walked: the walkable
//                   ground, the no-walk blobs, doors, exits, things and lights, each labelled
//    bg_*           a battle backdrop (also the standIn for battleBG when the game has none)
//    creatures      a plain animal-shaped mark
//  Every stand-in carries the words STAND-IN and its asset name. assetImg() asks standInImage(name) only for a name that is not in
//  ASSET_SRC, so the app's file of the same name always wins and nothing here runs for it. STANDIN.made lists what was drawn (a test
//  reads it). These are not art layers: the real walkable ground and cut-outs come from the image model, never from this file.
//  A cast entry may carry `look`: { tunic, belt, skin, hair, legs, beard, long, toga, disc, shield } (CSS colours / flags).
// ============================================================
const STANDIN = { made: [], cache: {} };
function standInCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; }
function standInHash(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function standInRand(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function standInMark(g, w, h, label) {
  g.save(); g.font = `bold ${Math.max(11, Math.round(w / 90))}px sans-serif`; g.textBaseline = 'bottom'; g.textAlign = 'right';
  const t = 'STAND-IN · ' + label, tw = g.measureText(t).width, k = Math.max(11, Math.round(w / 90));
  g.fillStyle = 'rgba(20,16,12,.55)'; g.fillRect(w - tw - k * 1.6, h - k * 2.2, tw + k * 1.1, k * 1.8); g.fillStyle = '#f2e6c8'; g.fillText(t, w - k, h - k * 0.55); g.restore();
}
function standInLook(id) {
  const e = typeof castList === 'function' && castList().find(c => c.id === id), h = standInHash(id), hue = h % 360;
  const L = Object.assign({ tunic: `hsl(${hue},28%,52%)`, belt: '#4a3420', skin: `hsl(${24 + h % 8},42%,${52 + h % 12}%)`, hair: `hsl(${(h >> 3) % 40 + 10},30%,${14 + h % 30}%)` }, (e && e.look) || {});
  L.legs = L.legs || L.skin; return L;
}
// a plain standing figure, feet at oy + 96, about 88 px tall; dir 0 front, 1 back, 2 left profile; step -1 / 0 / 1
function standInDraw(g, ox, oy, L, dir, s) {
  const cx = ox + 42, fy = oy + 96, ol = '#1e1610';
  g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(cx, fy, 16, 4, 0, 0, 7); g.fill();
  g.fillStyle = L.legs;
  if (dir === 2) { g.fillRect(cx - 5 + s * 6, fy - 30, 7, 30); g.fillRect(cx - 2 - s * 6, fy - 30, 7, 30); }
  else { g.fillRect(cx - 10, fy - 30 + (s > 0 ? -2 : 0), 8, 30); g.fillRect(cx + 2, fy - 30 + (s < 0 ? -2 : 0), 8, 30); }
  g.fillStyle = ol; if (dir === 2) { g.fillRect(cx - 8 + s * 6, fy - 3, 10, 3); g.fillRect(cx - 5 - s * 6, fy - 3, 10, 3); } else { g.fillRect(cx - 11, fy - 3, 10, 3); g.fillRect(cx + 1, fy - 3, 10, 3); }
  const bw = L.toga ? 38 : 32, top = fy - 72;
  g.fillStyle = L.tunic; g.fillRect(cx - bw / 2, top, bw, L.long ? 64 : 44);
  if (L.toga) { g.fillStyle = 'rgba(0,0,0,.12)'; g.beginPath(); g.moveTo(cx - bw / 2, top); g.lineTo(cx + bw / 2, top + 40); g.lineTo(cx + bw / 2, top + 48); g.lineTo(cx - bw / 2, top + 8); g.fill(); }
  g.fillStyle = L.belt; g.fillRect(cx - bw / 2, top + 26, bw, 4);
  if (L.disc && dir !== 1) { g.fillStyle = L.disc; g.beginPath(); g.arc(cx + (dir === 2 ? -4 : 0), top + 14, 9, 0, 7); g.fill(); g.strokeStyle = ol; g.lineWidth = 1.5; g.stroke(); }
  g.fillStyle = L.skin;
  if (dir === 2) g.fillRect(cx - 4 - s * 4, top + 4, 7, 32);
  else { g.fillRect(cx - bw / 2 - 6, top + 4 + (s > 0 ? 2 : 0), 6, 30); g.fillRect(cx + bw / 2, top + 4 + (s < 0 ? 2 : 0), 6, 30); }
  if (L.shield && dir !== 1) { g.fillStyle = L.shield; g.beginPath(); g.ellipse(cx + (dir === 2 ? -14 : 18), top + 26, 10, 18, 0, 0, 7); g.fill(); g.strokeStyle = ol; g.lineWidth = 2; g.stroke(); }
  const hx = cx + (dir === 2 ? -3 : 0), hy = top - 12;
  g.fillStyle = L.skin; g.beginPath(); g.ellipse(hx, hy, 10, 12, 0, 0, 7); g.fill();
  g.fillStyle = L.hair;
  if (dir === 1) { g.beginPath(); g.ellipse(hx, hy - 2, 10.5, 11, 0, 0, 7); g.fill(); }
  else if (dir === 2) { g.beginPath(); g.ellipse(hx + 4, hy - 5, 9, 8, 0, 0, 7); g.fill(); g.fillStyle = ol; g.fillRect(hx - 6, hy - 2, 2, 2); }
  else { g.beginPath(); g.ellipse(hx, hy - 8, 10.5, 6, 0, Math.PI, 0); g.fill(); g.fillStyle = ol; g.fillRect(hx - 5, hy - 1, 2, 2); g.fillRect(hx + 3, hy - 1, 2, 2); }
  if (L.beard && dir !== 1) { g.fillStyle = L.beard; g.fillRect(hx - (dir === 2 ? 9 : 6), hy + 4, dir === 2 ? 8 : 12, 6); }
  if (L.long && dir !== 0) { g.fillStyle = L.hair; g.fillRect(hx - 9 + (dir === 2 ? 6 : 0), hy - 4, 8, 22); }
  g.strokeStyle = ol; g.lineWidth = 1.5; g.strokeRect(cx - bw / 2, top, bw, L.long ? 64 : 44);
}
function standInNote(name) { if (!STANDIN.made.includes(name)) STANDIN.made.push(name); }
function standInSheet(id) {
  const [c, g] = standInCanvas(CAST_CELL[0] * 3, CAST_CELL[1] * 3), L = standInLook(id);
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) standInDraw(g, col * CAST_CELL[0], row * CAST_CELL[1], L, row, col === 0 ? 0 : col === 1 ? 1 : -1);
  g.fillStyle = 'rgba(20,16,12,.7)'; g.fillRect(0, 0, 252, 9); g.fillStyle = '#f2e6c8'; g.font = 'bold 8px sans-serif'; g.textBaseline = 'top'; g.fillText('STAND-IN ' + id, 2, 0);
  return c;
}
function standInPortraitCard(id) {
  const [c, g] = standInCanvas(144, 144), L = standInLook(id);
  g.fillStyle = '#d8c8a4'; g.fillRect(0, 0, 144, 144);
  g.save(); g.scale(1.6, 1.6); g.translate(-2, 6); standInDraw(g, 0, 0, L, 0, 0); g.restore();
  g.fillStyle = 'rgba(20,16,12,.6)'; g.fillRect(0, 126, 144, 18); g.fillStyle = '#f2e6c8'; g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.fillText('STAND-IN', 72, 139);
  return c;
}
// the figure callers of charSprite / portrait / creatureSprite get when nothing better exists (cached, but only counted when a game opted in)
function standInFigure(id, dir, fr) {
  const key = 'fig:' + id + ':' + dir + ':' + fr; if (STANDIN.cache[key]) return STANDIN.cache[key];
  const [c, g] = standInCanvas(CAST_CELL[0], CAST_CELL[1]); standInDraw(g, 0, 0, standInLook(id), dir === 3 ? 2 : dir, fr === 1 ? 1 : fr === 3 ? -1 : 0);
  if (dir === 3) { const [m, mg] = standInCanvas(CAST_CELL[0], CAST_CELL[1]); mg.translate(CAST_CELL[0], 0); mg.scale(-1, 1); mg.drawImage(c, 0, 0); return (STANDIN.cache[key] = m); }
  return (STANDIN.cache[key] = c);
}
function standInPortrait(id) {
  const key = 'pt:' + id; if (STANDIN.cache[key]) return STANDIN.cache[key];
  const c = document.createElement('canvas'); c.width = c.height = 72 * S; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(standInPortraitCard(id), 0, 0, c.width, c.height);
  return (STANDIN.cache[key] = c);
}
function standInCreature(kind, fr, right) {
  const key = 'cr:' + kind + ':' + (fr % 2) + (right ? 'R' : 'L'); if (STANDIN.cache[key]) return STANDIN.cache[key];
  const [c, g] = standInCanvas(44, 32), L = standInLook('creature_' + kind), up = fr % 2;
  g.fillStyle = L.tunic; g.beginPath(); g.ellipse(22, 18, 14, 7, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(8, 12, 6, 5, 0, 0, 7); g.fill();
  g.fillStyle = L.hair; g.fillRect(14, 22, 4, 8 - up * 2); g.fillRect(28, 22, 4, 8 + up * 2 - 2);
  g.fillStyle = '#1e1610'; g.fillRect(6, 10, 2, 2);
  if (right) { const [m, mg] = standInCanvas(44, 32); mg.translate(44, 0); mg.scale(-1, 1); mg.drawImage(c, 0, 0); return (STANDIN.cache[key] = m); }
  return (STANDIN.cache[key] = c);
}

// ---- a painting, from the scene JSON's own geometry (SCENE_JSON, 05c_scene.js SCENES) ----
function standInPolys(g, polys, fill) { g.fillStyle = fill; for (const poly of polys || []) { if (!poly || poly.length < 3) continue; g.beginPath(); poly.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fill(); } }
function standInLabel(g, r, text, col, size) {
  g.save(); g.font = `bold ${size}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = Math.max(2, size / 6); g.strokeStyle = 'rgba(20,16,12,.8)';
  const x = (r[0] + r[2]) / 2, y = (r[1] + r[3]) / 2; g.strokeText(text, x, y); g.fillStyle = col; g.fillText(text, x, y); g.restore();
}
function standInPainting(sc) {
  const w = sc.iw || 1672, h = sc.ih || 941, [c, g] = standInCanvas(w, h), r = standInRand(standInHash(sc.id || sc.img)), hue = standInHash(sc.id || sc.img) % 360, k = Math.max(w / 1672, 1);
  g.fillStyle = `hsl(${hue},14%,24%)`; g.fillRect(0, 0, w, h);                                               // outside the walkable ground
  for (let i = 0; i < w * h / 4000; i++) { g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.05)'; g.fillRect(r() * w, r() * h, 10 * k, 4 * k); }
  standInPolys(g, sc.walk, `hsl(${hue},24%,46%)`);                                                           // the ground
  for (let i = 0; i < w * h / 6000; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.08)'; g.fillRect(r() * w, r() * h, 8 * k, 3 * k); }
  standInPolys(g, sc.nowalk, `hsl(${hue},12%,20%)`); standInPolys(g, sc.block, `hsl(${hue},10%,16%)`);
  g.lineWidth = 4 * k;
  for (const d of sc.doors || []) { const q = d.r; g.fillStyle = '#5a3e22'; g.fillRect(q[0], q[1], q[2] - q[0], q[3] - q[1]); g.strokeStyle = '#2a1a0c'; g.strokeRect(q[0], q[1], q[2] - q[0], q[3] - q[1]); standInLabel(g, q, 'door' + (d.to ? ' → ' + d.to : ''), '#f2e6c8', 16 * k); }
  for (const e of sc.exits || []) { const q = e.r; g.fillStyle = 'rgba(240,220,150,.22)'; g.fillRect(q[0], q[1], q[2] - q[0], q[3] - q[1]); g.strokeStyle = 'rgba(240,220,150,.8)'; g.setLineDash([12 * k, 8 * k]); g.strokeRect(q[0], q[1], q[2] - q[0], q[3] - q[1]); g.setLineDash([]); standInLabel(g, q, 'exit' + (e.to ? ' → ' + e.to : ''), '#f2e6c8', 16 * k); }
  for (const t of sc.things || []) { const q = t.r; g.strokeStyle = 'rgba(200,230,255,.7)'; g.strokeRect(q[0], q[1], q[2] - q[0], q[3] - q[1]); standInLabel(g, q, '?', '#dbe9f6', 18 * k); }
  for (const l of sc.lights || []) { const gl = g.createRadialGradient(l[0], l[1], 4, l[0], l[1], l[2] || 120); gl.addColorStop(0, 'rgba(255,200,110,.5)'); gl.addColorStop(1, 'rgba(255,200,110,0)'); g.fillStyle = gl; g.fillRect(l[0] - (l[2] || 120), l[1] - (l[2] || 120), 2 * (l[2] || 120), 2 * (l[2] || 120)); }
  if (sc.start) { g.strokeStyle = '#ffffff'; g.beginPath(); g.arc(sc.start[0], sc.start[1], 18 * k, 0, 7); g.stroke(); }
  g.font = `bold ${30 * k}px sans-serif`; g.textAlign = 'left'; g.fillStyle = 'rgba(255,255,255,.55)'; g.fillText(sc.name || sc.id || '', 30 * k, 48 * k);
  standInMark(g, w, h, sc.img);
  return c;
}
function standInBackdrop(kind) {
  const [c, g] = standInCanvas(1280, 720), hue = standInHash(kind) % 360, sky = g.createLinearGradient(0, 0, 0, 360);
  sky.addColorStop(0, `hsl(${hue},30%,16%)`); sky.addColorStop(1, `hsl(${hue},24%,34%)`); g.fillStyle = sky; g.fillRect(0, 0, 1280, 360);
  g.fillStyle = `hsl(${hue},18%,26%)`; g.fillRect(0, 360, 1280, 360);
  const r = standInRand(standInHash(kind)); for (let i = 0; i < 700; i++) { g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.05)'; g.fillRect(r() * 1280, 360 + r() * 360, 5, 2); }
  standInMark(g, 1280, 720, 'bg_' + kind);
  return c;
}
// the battle backdrop for a kind of ground: the game's (hook battleBG), else a stand-in (07b battleBackdrop)
function battleBackdropArt(kind) { return gameHook('battleBG', kind) || (STANDIN.cache['bg:' + kind] = STANDIN.cache['bg:' + kind] || standInBackdrop(kind || 'field')); }

// assetImg(name) for a name no file will fill: the stand-in for the patterns above, built once. Null for anything else.
function standInImage(name) {
  if (!GAME.standIn || (typeof ASSET_SRC === 'object' && ASSET_SRC[name])) return null;
  if (name in STANDIN.cache) return STANDIN.cache[name];
  let c = null, m;
  if ((m = /^char_(.+)$/.exec(name))) c = standInSheet(m[1]);
  else if ((m = /^portrait_(.+)$/.exec(name))) c = standInPortraitCard(m[1]);
  else if (/^bg_/.test(name)) c = standInBackdrop(name.slice(3));
  else if (typeof SCENES === 'object') { const sc = Object.values(SCENES).find(s => s && s.img === name); if (sc) c = standInPainting(sc); }
  STANDIN.cache[name] = c; if (c) standInNote(name);
  return c;
}
