// ============================================================
//  Living world: time of day, water shimmer, god rays,
//  fauna (dragonflies, butterflies, birds, fireflies, fish rings)
// ============================================================
// Time of day for a map or scene m: the game's (GAME_HOOKS.timeOfDay(m) -> { amb, sh, shA, rays, tint, key, flies, butter }), else broad daylight.
function timeOfDay(m) { return gameHook('timeOfDay', m) || { amb: '#ffffff', sh: 0, shA: 0, rays: 0, tint: null, key: 'day', flies: 0, butter: 0 }; }
// ---- water shimmer: tileable animated highlight streaks ----
const WATER_FR = [];
function waterFrame(i) {
  if (WATER_FR[i]) return WATER_FR[i];
  const S_ = 96, [c, g] = mk(S_, S_);
  for (let k = 0; k < 26; k++) {
    const x0 = hash(k, 1, 3) * S_, y0 = hash(1, k, 3) * S_, len = 3 + Math.floor(hash(k, k, 4) * 7), ph = hash(k, 2, 5) * 8;
    const a = Math.sin(((i + ph) / 8) * Math.PI * 2); if (a < -0.2) continue;
    const x = Math.round(x0 + i * 0.75) % S_, y = Math.round(y0);
    g.fillStyle = a > 0.6 ? PAL11.water[10] : PAL11.water[8];
    g.fillRect(x, y, len, 1); if (x + len > S_) g.fillRect(x - S_, y, len, 1);
    if (a > 0.8) { g.fillStyle = '#ffffff'; g.fillRect(x + 1, y, Math.max(1, len - 3), 1); }
  }
  for (let k = 0; k < 10; k++) { const x = Math.floor(hash(k, 7, 8) * S_), y = Math.floor(hash(7, k, 8) * S_); if ((i + k) % 8 < 2) { g.fillStyle = '#ffffff'; g.fillRect(x, y, 1, 1); } }
  const p = L.createPattern(c, 'repeat'); WATER_FR[i] = p; return p;
}
function drawWaterShimmer(dx, dy, w, h, cx, cy) {
  const p = waterFrame(Math.floor(frame / 6) % 8);
  L.save(); L.translate(-cx, -cy); L.fillStyle = p; L.globalAlpha = 0.75; L.fillRect(dx + cx, dy + cy, w, h); L.restore();
}
// ---- god rays through the dusk haze ----
function drawGodRays(strength) {
  if (!strength) return;
  L.save(); L.globalCompositeOperation = 'screen';
  for (let i = 0; i < 4; i++) {
    const x = ((i * 190 + frame * 0.06) % (W + 300)) - 200, w = 40 + (i % 2) * 30, a = strength * (0.6 + Math.sin(frame / 90 + i * 2) * 0.4);
    const gr = L.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, `rgba(255,214,150,${a})`); gr.addColorStop(1, 'rgba(255,214,150,0)');
    L.fillStyle = gr; L.beginPath(); L.moveTo(x, 0); L.lineTo(x + w, 0); L.lineTo(x + w + 220, H); L.lineTo(x + 180, H); L.fill();
  }
  L.restore();
}
// ---- fauna ----
const FAUNA = { list: [], mapId: null, birds: null };
function faunaReset(m) {
  FAUNA.list = []; FAUNA.mapId = m.id; FAUNA.birds = null;
  if (!m.outdoor) return;
  const tod = timeOfDay(m);
  const spot = kinds => { for (let t = 0; t < 60; t++) { const x = ri(2, m.w - 3), y = ri(3, m.h - 3); if (kinds.includes(m.groundType(x, y))) return [x * T + 16, y * T + 16]; } return null; };
  for (let i = 0; i < 10; i++) { const s = spot(['paddy', 'grass', 'dry', 'lilies']); if (s) FAUNA.list.push({ k: 'fly', x: s[0], y: s[1], hx: s[0], hy: s[1], vx: 0, vy: 0, z: 14 + Math.random() * 10, t: ri(0, 90) }); }
  if (tod.butter) for (let i = 0; i < 6; i++) { const s = spot(['grass', 'lilies']); if (s) FAUNA.list.push({ k: 'bfly', x: s[0], y: s[1], hx: s[0], hy: s[1], z: 10, t: ri(0, 200), c: i % 2 ? PAL11.plaster[10] : PAL11.gold[9] }); }
  if (tod.flies) for (let i = 0; i < 18; i++) { const s = spot(['water', 'lilies', 'paddy']); if (s) FAUNA.list.push({ k: 'ffly', x: s[0] + rnd(-40, 40), y: s[1] + rnd(-30, 30), hx: s[0], hy: s[1], z: 8 + Math.random() * 20, t: ri(0, 400) }); }
}
function faunaUpdate(m) {
  if (FAUNA.mapId !== m.id) faunaReset(m);
  const p = G.p;
  for (const f of FAUNA.list) {
    f.t++;
    if (f.k === 'fly') { // dart, hover, dart
      if (f.t % 70 === 0 || Math.hypot(f.x - p.px - 16, f.y - p.py - 16) < 40) { const a = Math.random() * Math.PI * 2, sp = 1.6 + Math.random() * 1.6; f.vx = Math.cos(a) * sp; f.vy = Math.sin(a) * sp * 0.7; }
      f.x += f.vx; f.y += f.vy; f.vx *= 0.93; f.vy *= 0.93;
      f.x += (f.hx - f.x) * 0.004; f.y += (f.hy - f.y) * 0.004;
    } else if (f.k === 'bfly') {
      f.x += Math.sin(f.t / 40) * 0.5 + Math.sin(f.t / 7) * 0.3; f.y += Math.cos(f.t / 55) * 0.35; f.z = 10 + Math.abs(Math.sin(f.t / 9)) * 8;
      f.x += (f.hx - f.x) * 0.003; f.y += (f.hy - f.y) * 0.003;
    } else if (f.k === 'ffly') { f.x += Math.sin(f.t / 50 + f.hx) * 0.3; f.y += Math.cos(f.t / 60 + f.hy) * 0.2; f.z = 10 + Math.sin(f.t / 30) * 6; }
  }
  // a flock of birds now and then, casting shadows as it passes
  if (m.outdoor && !FAUNA.birds && Math.random() < 0.002) FAUNA.birds = { x: G.cam ? G.cam[0] - 60 : 0, y: (G.cam ? G.cam[1] : 0) + rnd(40, 200), n: ri(3, 6), t: 0, vx: rnd(1.1, 1.6), vy: rnd(-0.3, 0.1) };
  if (FAUNA.birds) { const b = FAUNA.birds; b.t++; b.x += b.vx; b.y += b.vy; if (!G.cam || b.x > G.cam[0] + W + 120) FAUNA.birds = null; }
  // fish rings on the water
  if (m.outdoor && Math.random() < 0.02 && G.cam) { for (let t = 0; t < 6; t++) { const x = Math.floor((G.cam[0] + Math.random() * W) / T), y = Math.floor((G.cam[1] + Math.random() * H) / T); if (m.groundType(x, y) === 'water' && m.groundType(x, y - 1) === 'water') { PARTS.push({ x: x * T + rnd(6, 26), y: y * T + rnd(8, 26), vx: 0, vy: 0, t: 0, life: 50, kind: 'ring' }); break; } } }
}
function drawFaunaShadows(sg, cx, cy) {
  if (FAUNA.birds) { const b = FAUNA.birds; for (let i = 0; i < b.n; i++) { sg.fillStyle = 'rgba(20,12,30,.5)'; sg.fillRect(Math.round(b.x - cx - i * 14 + 60), Math.round(b.y - cy + (i % 2) * 10 + 90), 6, 2); } }
}
function drawFauna(cx, cy) {
  for (const f of FAUNA.list) {
    const x = Math.round(f.x - cx), y = Math.round(f.y - cy - f.z); if (x < -10 || y < -10 || x > W + 10 || y > H + 10) continue;
    if (f.k === 'fly') {
      L.fillStyle = 'rgba(20,12,30,.25)'; L.fillRect(x - 1, y + f.z, 4, 1);
      const w = Math.floor(f.t / 2) % 2; L.fillStyle = PAL11.red[7]; L.fillRect(x - 2, y, 5, 1); L.fillStyle = PAL11.red[4]; L.fillRect(x + 3, y, 1, 1);
      L.fillStyle = 'rgba(230,240,255,.8)'; L.fillRect(x - 1, y - 1 - w, 1, 1); L.fillRect(x + 1, y - 1 - w, 1, 1); L.fillRect(x - 1, y + 1 + w, 1, 1); L.fillRect(x + 1, y + 1 + w, 1, 1);
    } else if (f.k === 'bfly') {
      const w = Math.floor(f.t / 4) % 2; L.fillStyle = 'rgba(20,12,30,.2)'; L.fillRect(x - 1, y + f.z, 3, 1);
      L.fillStyle = f.c; if (w) { L.fillRect(x - 2, y - 1, 2, 2); L.fillRect(x + 1, y - 1, 2, 2); } else { L.fillRect(x - 1, y - 2, 1, 3); L.fillRect(x + 1, y - 2, 1, 3); }
      L.fillStyle = PAL11.night[3]; L.fillRect(x, y - 1, 1, 2);
    }
  }
  if (FAUNA.birds) { const b = FAUNA.birds; for (let i = 0; i < b.n; i++) { const x = Math.round(b.x - cx - i * 14), y = Math.round(b.y - cy + (i % 2) * 10), f = Math.floor((b.t + i * 5) / 7) % 2; L.fillStyle = PAL11.night[2]; L.fillRect(x, y, 2, 1); L.fillRect(x - 3, y - f, 3, 1); L.fillRect(x + 2, y - f, 3, 1); L.fillRect(x - 4, y - f * 2 + (f ? 0 : 1), 1, 1); L.fillRect(x + 5, y - f * 2 + (f ? 0 : 1), 1, 1); } }
}
function drawFireflies(cx, cy) {
  L.save(); L.globalCompositeOperation = 'lighter';
  for (const f of FAUNA.list) {
    if (f.k !== 'ffly') continue; const a = Math.max(0, Math.sin(f.t / 25 + f.hx)); if (a < 0.1) continue;
    const x = Math.round(f.x - cx), y = Math.round(f.y - cy - f.z); if (x < -10 || y < -10 || x > W + 10 || y > H + 10) continue;
    L.globalAlpha = a * 0.7; L.drawImage(glowSprite(6, '#e8ff90'), x - 6, y - 6); L.globalAlpha = a; L.fillStyle = '#f4ffc0'; L.fillRect(x, y, 1, 1);
  }
  L.restore();
}
