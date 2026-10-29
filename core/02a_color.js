// ============================================================
//  Art foundation: color ramps, noise, pixel buffers
// ============================================================
const OUTLINE = '#1a1220';
function hex2rgb(h) { const n = parseInt(h.slice(1, 7), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function rgb2hex(r, g, b) { return '#' + ((1 << 24) + (clamp(Math.round(r), 0, 255) << 16) + (clamp(Math.round(g), 0, 255) << 8) + clamp(Math.round(b), 0, 255)).toString(16).slice(1); }
function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
  return [h, s, l];
}
function hsl2rgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360; if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}
function hueToward(h, target, amt) { let d = ((target - h + 540) % 360) - 180; return h + clamp(d, -amt, amt); }
const TONE_CACHE = {};
// k < 0: shadow (cooler, darker, richer). k > 0: highlight (warmer, lighter).
function tone(hex, k) {
  const key = hex + k; if (TONE_CACHE[key]) return TONE_CACHE[key];
  let [h, s, l] = rgb2hsl(...hex2rgb(hex));
  if (k < 0) { h = hueToward(h, 250, -k * 22); l = l * (1 + k * 0.62); s = Math.min(1, s * (1 - k * 0.12)); }
  else { h = hueToward(h, 48, k * 16); l = l + (1 - l) * k * 0.6; s = s * (1 - k * 0.12); }
  return (TONE_CACHE[key] = rgb2hex(...hsl2rgb(h, s, l)));
}
function ramp(hex) { return { o: tone(hex, -0.8), d2: tone(hex, -0.5), d: tone(hex, -0.25), b: hex, l: tone(hex, 0.25), h: tone(hex, 0.5) }; }
function mixHex(a, b, t) { const A = hex2rgb(a), B = hex2rgb(b); return rgb2hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); }
const shade = (hex, amt) => tone(hex, amt);

// ---------- master palette (Sea of Stars inspired: hue-shifted, saturated, 11-step ramps) ----------
const PAL = {
  grass: ['#16302c', '#1f4a36', '#2e6a3c', '#4a8a3e', '#78aa44', '#b4cc5a'],
  dry: ['#3a2c22', '#5e4a2c', '#8a7036', '#b49a4a', '#d8c070', '#f0e0a0'],
  dirt: ['#2e1c22', '#56362c', '#82573a', '#aa7c4e', '#cca26a', '#ead096'],
  stone: ['#1c1c2c', '#363a4e', '#565c70', '#7e8494', '#aab0b8', '#dcdcdc'],
  water: ['#0c1a3a', '#15326a', '#1e5898', '#2e82bc', '#58b0da', '#a8e2f2'],
  wood: ['#1e1016', '#3e2020', '#643824', '#8e5632', '#b67c46', '#d8a868'],
  plaster: ['#6a5e60', '#948676', '#bcae98', '#dcd0b6', '#f2ead4', '#fffaec'],
  roof: ['#141626', '#232842', '#363e5e', '#4e587e', '#7280a4', '#a2b0cc'],
  thatch: ['#2c1e18', '#553a22', '#80592c', '#aa7e3c', '#cfa45a', '#ecca84'],
  red: ['#3a0c18', '#6e1420', '#a8241e', '#d8482a', '#f07e44', '#fab874'],
  gold: ['#3a2410', '#6e4618', '#a8701e', '#d8a232', '#f4d05e', '#fff2a8'],
  pine: ['#0a1e22', '#123230', '#1e4c3c', '#2e6a46', '#4e8c50', '#86b262'],
  skin: ['#4a2226', '#8a4a40', '#c47a5c', '#eaa882', '#fac8a0', '#ffe6cc'],
  hair: ['#0e0a14', '#1c1422', '#2e2234', '#463648', '#64526a', '#8a7a8c'],
  indigo: ['#0e0e2a', '#1a1c4a', '#28307a', '#3a4aa8', '#5a74cc', '#90aee8'],
  violet: ['#1e0e24', '#3a1a42', '#5e2a64', '#86408a', '#b066ac', '#d898cc'],
  teal: ['#0a2224', '#12383a', '#1e5a56', '#2e7e72', '#50a48e', '#88ccb0'],
  night: ['#06040a', '#0e0a18', '#1a1428', '#2a2238', '#40364e', '#5e5470'],
  bark: ['#170f14', '#2c2024', '#453434', '#624c44', '#857058', '#ad9a7c'],
  moss: ['#1a2a18', '#2c4420', '#46642a', '#6c8a34', '#9cb04a', '#cad478'],
  maple: ['#3a0a14', '#761a1c', '#b8321e', '#e45a26', '#f8903a', '#ffc46a'],
  bamboo: ['#0e2620', '#1a4030', '#2c6440', '#4a8a4a', '#80b25a', '#c2dc86'],
  sky: ['#2a3a6a', '#3e5a94', '#5a82bc', '#86aed8', '#b6d4ec', '#e6f2fa'],
};
// 11-step ramps: the 6 key colours plus hue-correct midpoints between each pair
function mid(a, b) { const A = rgb2hsl(...hex2rgb(a)), B = rgb2hsl(...hex2rgb(b)); let dh = ((B[0] - A[0] + 540) % 360) - 180; return rgb2hex(...hsl2rgb(A[0] + dh / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2)); }
function to11(p) { const o = []; for (let i = 0; i < p.length; i++) { o.push(p[i]); if (i < p.length - 1) o.push(mid(p[i], p[i + 1])); } return o; }
const PAL11 = {}; for (const k in PAL) PAL11[k] = to11(PAL[k]);
const MASTER = [].concat(...Object.values(PAL11), ['#120c18', '#f8f4ec', '#ffffff', '#000000', '#fff6d8', '#ffe2a0']);
const MASTER_RGB = MASTER.map(hex2rgb);
const QLUT = new Int16Array(32768).fill(-1);
function quant(r, g, b) {
  const k = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
  let i = QLUT[k];
  if (i < 0) {
    let best = 1e9; const rr = (r & 248) + 4, gg = (g & 248) + 4, bb = (b & 248) + 4;
    for (let j = 0; j < MASTER_RGB.length; j++) { const c = MASTER_RGB[j], dr = c[0] - rr, dg = c[1] - gg, db = c[2] - bb; const rm = (c[0] + rr) / 2; const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db; if (d < best) { best = d; i = j; } }
    QLUT[k] = i;
  }
  return MASTER_RGB[i];
}
function quantizeCanvas(c) {
  const g = c.getContext('2d'), id = g.getImageData(0, 0, c.width, c.height), d = id.data;
  for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 30) { d[i + 3] = 0; continue; } const q = quant(d[i], d[i + 1], d[i + 2]); d[i] = q[0]; d[i + 1] = q[1]; d[i + 2] = q[2]; d[i + 3] = 255; }
  g.putImageData(id, 0, 0); return c;
}
// ramp object: o d2 d b l h (+ a: the full 11-step array)
function mkRamp(arr6) { const a = to11(arr6); return { o: arr6[0], d2: arr6[1], d: arr6[2], b: arr6[3], l: arr6[4], h: arr6[5], a }; }
const PR_CACHE = {};
const PR = name => PR_CACHE[name] || (PR_CACHE[name] = mkRamp(PAL[name]));
const RC = hex => PR_CACHE[hex] || (PR_CACHE[hex] = mkRamp(rampArr(hex)));
function rampArr(c) {
  if (Array.isArray(c)) return c;
  if (PAL[c]) return PAL[c];
  return [tone(c, -0.8), tone(c, -0.5), tone(c, -0.25), c, tone(c, 0.25), tone(c, 0.5)];
}
// sample an 11-step ramp at t (0 = darkest, 1 = brightest)
const band = (R, t) => { const a = R.a || to11([R.o, R.d2, R.d, R.b, R.l, R.h]); return a[clamp(Math.round(t * 10), 0, 10)]; };
const ART = 1; // art is authored at native 640x360: one art pixel per screen pixel
function px2(c) { return c; }
// ---------- noise ----------
function vnoise(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, s = 0, o = 3) { let t = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < o; i++) { t += vnoise(x * f, y * f, s + i * 17) * a; n += a; a *= 0.5; f *= 2; } return t / n; }

// ---------- canvas helpers ----------
function painter(g) { return { p: (x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); }, r: (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); } }; }
function mirror(c) { const [m, g] = mk(c.width, c.height); g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0); return m; }
function scaleUp(c, k) { const [m, g] = mk(c.width * k, c.height * k); g.imageSmoothingEnabled = false; g.drawImage(c, 0, 0, c.width * k, c.height * k); return m; }
function addOutline(c, col) {
  const g = c.getContext('2d'), w = c.width, h = c.height;
  const id = g.getImageData(0, 0, w, h), d = id.data, out = [];
  const a = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 40;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!a(x, y)) {
    let src = -1;
    if (a(x - 1, y)) src = (y * w + x - 1); else if (a(x + 1, y)) src = (y * w + x + 1); else if (a(x, y - 1)) src = ((y - 1) * w + x); else if (a(x, y + 1)) src = ((y + 1) * w + x);
    if (src >= 0) out.push([x, y, src]);
  }
  for (const [x, y, s] of out) {
    const i = (y * w + x) * 4;
    if (col) { const [r, gg, b] = hex2rgb(col); d[i] = r; d[i + 1] = gg; d[i + 2] = b; }
    else { d[i] = d[s * 4] * 0.2 + 14; d[i + 1] = d[s * 4 + 1] * 0.16 + 9; d[i + 2] = d[s * 4 + 2] * 0.22 + 22; }
    d[i + 3] = 255;
  }
  g.putImageData(id, 0, 0); return c;
}

// Pixel buffer with automatic form shading (light from upper-left).
// Shading bands are measured in pixels; at native resolution they are wider and use the 11-step ramps.
const LIGHT = { x: -0.55, y: -0.7, z: 0.46 };
class PB {
  constructor(w, h) { this.w = w; this.h = h; this.col = new Array(w * h).fill(null); }
  set(x, y, c) { x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= this.w || y >= this.h || !c) return; this.col[y * this.w + x] = c; }
  get(x, y) { x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null; return this.col[y * this.w + x]; }
  rect(x, y, w, h, c) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c); }
  // mask(x,y) → bool. rp: ramp. opts: {flat, lx, ly, soft, noHi, rim (px), dark (bias)}
  shape(mask, rp, x0, y0, x1, y1, opts = {}) {
    const lx = opts.lx == null ? -1 : opts.lx, ly = opts.ly == null ? -1.2 : opts.ly;
    const K = opts.rim || 5, bias = opts.dark || 0;
    x0 = Math.floor(x0); y0 = Math.floor(y0); x1 = Math.ceil(x1); y1 = Math.ceil(y1);
    const ins = (x, y) => x >= x0 && y >= y0 && x <= x1 && y <= y1 && mask(x, y);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (!mask(x, y)) continue;
      if (opts.flat) { this.set(x, y, rp.b); continue; }
      let dl = K, dr = K;
      for (let k = 1; k <= K; k++) { if (!ins(Math.round(x + lx * k), Math.round(y + ly * k))) { dl = k - 1; break; } }
      for (let k = 1; k <= K; k++) { if (!ins(Math.round(x - lx * k), Math.round(y - ly * k))) { dr = k - 1; break; } }
      // t: 0.3 deep shadow rim → 0.6 body → 0.95 lit rim
      let t = 0.6;
      if (dr < K) t = 0.2 + dr / K * 0.4;
      if (dl < K && dl < dr) t = 0.95 - dl / K * 0.35;
      t -= bias;
      if (opts.soft) t = Math.max(t, 0.35);
      if (opts.noHi) t = Math.min(t, 0.8);
      if (opts.cap != null) t = Math.min(t, opts.cap);
      this.set(x, y, band(rp, t));
    }
  }
  // lambert-shaded ellipsoid (smooth volumes: foliage balls, jars, heads)
  ball(cx, cy, rx, ry, rp, opts = {}) {
    const lo = opts.lo == null ? 0.18 : opts.lo, hi = opts.hi == null ? 1 : opts.hi;
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, d = nx * nx + ny * ny; if (d > 1) continue;
      if (opts.mask && !opts.mask(x, y)) continue;
      const nz = Math.sqrt(1 - d), l = clamp(-(nx * LIGHT.x + ny * LIGHT.y) * 0.8 + nz * LIGHT.z + 0.1, 0, 1);
      this.set(x, y, band(rp, lo + (hi - lo) * l));
    }
  }
  // vertical cylinder x0..x1 (trunks, bamboo, pillars)
  cyl(x0, x1, y0, y1, rp, opts = {}) {
    const lo = opts.lo == null ? 0.2 : opts.lo, hi = opts.hi == null ? 0.95 : opts.hi, w = x1 - x0 + 1;
    for (let x = x0; x <= x1; x++) { const u = (x - x0 + 0.5) / w * 2 - 1, nz = Math.sqrt(Math.max(0, 1 - u * u)), l = clamp(-u * LIGHT.x * 0.9 + nz * 0.55, 0, 1); const c = band(rp, lo + (hi - lo) * l); for (let y = y0; y <= y1; y++) this.set(x, y, c); }
  }
  ell(cx, cy, rx, ry, rp, opts) { this.shape((x, y) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1, rp, Math.floor(cx - rx - 1), Math.floor(cy - ry - 1), Math.ceil(cx + rx + 1), Math.ceil(cy + ry + 1), opts); }
  box(x, y, w, h, rp, opts) { this.shape((a, b) => a >= x && b >= y && a < x + w && b < y + h, rp, x, y, x + w - 1, y + h - 1, opts); }
  // trapezoid from (xa0..xa1 at y0) to (xb0..xb1 at y1)
  trap(y0, y1, xa0, xa1, xb0, xb1, rp, opts) {
    this.shape((x, y) => { if (y < y0 || y > y1) return false; const t = (y - y0) / Math.max(1, y1 - y0); return x >= Math.round(xa0 + (xb0 - xa0) * t) && x <= Math.round(xa1 + (xb1 - xa1) * t); }, rp, Math.min(xa0, xb0), y0, Math.max(xa1, xb1), y1, opts);
  }
  poly(pts, rp, opts) { // filled polygon, shaded
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const inside = (px, py) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) c = !c; } return c; };
    this.shape((x, y) => inside(x + 0.5, y + 0.5), rp, x0, y0, x1, y1, opts);
  }
  line(x0, y0, x1, y1, c, w = 1) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; if (w > 1) this.rect(Math.round(x - w / 2), Math.round(y), w, 1, c); else this.set(Math.round(x), Math.round(y), c); } }
  // thick curved stroke along a quadratic bezier with width w0→w1, shaded as a cylinder across its width
  stroke(p0, p1, p2, w0, w1, rp, opts = {}) {
    const n = Math.ceil(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + Math.hypot(p2[0] - p1[0], p2[1] - p1[1])) * 2 + 2;
    for (let i = 0; i <= n; i++) {
      const t = i / n, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
      const x = a * p0[0] + b * p1[0] + c * p2[0], y = a * p0[1] + b * p1[1] + c * p2[1], w = w0 + (w1 - w0) * t;
      for (let k = -w / 2; k <= w / 2; k += 0.5) { const u = k / Math.max(0.5, w / 2); const l = clamp(0.55 - u * 0.4 + (opts.bias || 0), 0, 1); this.set(x + k, y, band(rp, opts.flat ? 0.55 : l)); }
    }
  }
  toCanvas(outline = true, scale = 1) {
    const [c, g] = mk(this.w, this.h); const id = g.createImageData(this.w, this.h), d = id.data;
    for (let i = 0; i < this.col.length; i++) { const cc = this.col[i]; if (!cc) continue; const q = quant(...hex2rgb(cc)); d[i * 4] = q[0]; d[i * 4 + 1] = q[1]; d[i * 4 + 2] = q[2]; d[i * 4 + 3] = 255; }
    g.putImageData(id, 0, 0); if (outline) addOutline(c, typeof outline === 'string' ? outline : null);
    return scale > 1 ? scaleUp(c, scale) : c;
  }
}
// soft radial light sprite cache
const GLOW_CACHE = {};
function glowSprite(r, col) {
  const key = r + col; if (GLOW_CACHE[key]) return GLOW_CACHE[key];
  const [c, g] = mk(r * 2, r * 2); const gr = g.createRadialGradient(r, r, 0, r, r, r);
  const [R, G_, B_] = hex2rgb(col);
  gr.addColorStop(0, `rgba(${R},${G_},${B_},1)`); gr.addColorStop(0.35, `rgba(${R},${G_},${B_},.45)`); gr.addColorStop(1, `rgba(${R},${G_},${B_},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2); return (GLOW_CACHE[key] = c);
}
