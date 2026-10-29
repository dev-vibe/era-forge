// ============================================================
//  THEME plain: the test theme (job fw-F4, 29 Oct 2026). Flat shapes in the theme's own colours, nothing else: if a screen rendered with
//  this theme still shows paper, brush strokes or a red seal, something outside themes/ draws the game's look by itself
//  (tests/theme_test.py). Every widget of THEME_WIDGETS (src/01a_game.js) is here; a new widget must be added to every theme.
// ============================================================
const PLAIN_LUM = c => { const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(c)); if (!m) return 0; let h = m[1]; if (h.length === 3) h = h.replace(/./g, x => x + x);
  const n = parseInt(h, 16); return (0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255)) / 255; };
const plainBox = (x, y, w, h, fill, line) => { X.fillStyle = fill; X.fillRect(x * S, y * S, w * S, h * S); if (line) { X.strokeStyle = line; X.lineWidth = S; X.strokeRect(x * S + 0.5, y * S + 0.5, w * S - 1, h * S - 1); } };

defineThemeUI('panel', (x, y, w, h, style) => style === 1 ? plainBox(x, y, w, h, UI.ink) : plainBox(x, y, w, h, UI.paper, UI.soft));
defineThemeUI('selBar', (x, y, w, h) => plainBox(x, y, w, h, 'rgba(31,111,235,.18)'));
// on a panel, light text (the engine's old light-on-dark colours) becomes ink; the gold of names and headings takes the heading font
defineThemeUI('text', (col, p, shadow) => {
  if (!p) return [col, false, null];
  if (p.style === 1) return [UI.cream, true, null];
  const head = String(col).toLowerCase() === '#f6d890';
  return [head || PLAIN_LUM(col) > 0.55 ? UI.ink : col, head, null];
});
defineThemeUI('mark', (x, y, r, a) => {
  const im = themeArt('mark'); X.save(); X.globalAlpha = a;
  if (im) X.drawImage(im, (x - r) * S, (y - r) * S, r * 2 * S, r * 2 * S); else plainBox(x - r, y - r, r * 2, r * 2, UI.seal);
  X.restore();
});
defineThemeUI('bubble', (x, y, glyph) => {
  plainBox(x - 9, y - 8, 18, 15, UI.paper, UI.ink);
  X.font = `700 ${Math.round(10 * S)}px ${FONT_HEAD}`; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillStyle = UI.ink; X.fillText(glyph, x * S, y * S); X.textAlign = 'left'; X.textBaseline = 'top';
});
defineThemeUI('banner', (text, cx, y, a, size) => {
  const w = txtW(text, size) + 40; X.globalAlpha = a; plainBox(cx - w / 2, y - 14, w, 28, UI.ink);
  headTxt(text, cx, y - size * 0.62, UI.cream, size, 'center', 700, null); X.globalAlpha = 1;
});
defineThemeUI('gauge', (x, y, w, v, max, col, h) => {
  const f = clamp(v / max, 0, 1); plainBox(x, y, w, h, 'rgba(0,0,0,.25)'); if (f > 0) plainBox(x, y, Math.max(1, w * f), h, col === '#5aa8e0' ? UI.indigo : UI.seal);
});
defineThemeUI('stroke', (g, ax, ay, bx, by, wd, R, col, alpha) => {
  g.save(); g.globalAlpha = alpha; g.strokeStyle = UI.seal; g.lineWidth = Math.max(1, wd * 0.4); g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); g.restore();
});
let PLAIN_PAGE = null;
defineThemeUI('page', () => { if (PLAIN_PAGE) return PLAIN_PAGE; const [c, g] = mk(W * S, H * S); g.fillStyle = UI.paper; g.fillRect(0, 0, W * S, H * S); return (PLAIN_PAGE = c); });
defineThemeUI('stamp', (x, y, sz, glyph) => {
  plainBox(x, y, sz, sz, UI.seal);
  X.font = `700 ${Math.round(sz * 0.6 * S)}px ${FONT_HEAD}`; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillStyle = UI.cream; X.fillText(glyph, (x + sz / 2) * S, (y + sz / 2) * S); X.textAlign = 'left'; X.textBaseline = 'top';
});
defineThemeUI('liberation', (s, text) => {
  X.fillStyle = `rgba(0,0,0,${Math.min(0.7, s.t / 30)})`; X.fillRect(0, 0, W * S, H * S);
  plainBox(270, 90, 100, 100, UI.seal); headTxt(text.glyphs.join(''), 320, 124, UI.cream, 28, 'center', 700, null);
  if (s.t > 30) { headTxt(s.name, 320, 212, UI.cream, 24, 'center', 700, null); headTxt(text.label, 320, 246, UI.sealHi, 14, 'center', 700, null); }
});
defineThemeUI('cutIn', (c, n) => { const k = Math.min(1, c.t / 7, Math.max(0, (n - c.t) / 7)); X.save(); X.globalAlpha = k; plainBox(20, 150, 600, 30, UI.ink); headTxt(c.name, 320, 157, UI.cream, 15, 'center', 700, null); X.restore(); });
defineThemeUI('techTag', tg => { X.save(); X.globalAlpha = Math.max(0, Math.min(1, tg.t / 5, (56 - tg.t) / 18)); headTxt(tg.name, 320, 150, UI.cream, 14, 'center', 700, 'rgba(0,0,0,.8)'); X.restore(); });
defineThemeUI('titleLockup', a => {
  X.save(); X.globalAlpha = a; plainBox(24, 18, 300, 74, UI.paper, UI.soft);
  headTxt(GAME.title, 40, 26, UI.ink, 30, 'left', 700, null); headTxt(GAME.subtitle, 42, 66, UI.soft, 11, 'left', 700, null); X.restore();
});
defineThemeUI('artWash', (img, sx, sy, sw, sh, cw, ch) => { const [c, g] = mk(cw, ch); g.filter = 'grayscale(1)'; g.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch); g.filter = 'none'; return c; });
defineThemeUI('enso', (g, o, r, i, n) => { g.strokeStyle = UI.ink; g.lineWidth = 3 * S; g.beginPath(); g.arc(o, o, r, i / n * 6.283, (i + 1) / n * 6.283); g.stroke(); });
// battle: the standoff and the impact frame keep the painting (no ink wash), the wipe is a flat bar, every effect a flat shape
defineThemeUI('battleBackdrop', src => src);
defineThemeUI('battleImpact', g => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H); });
defineThemeUI('battleSil', s => s);
defineThemeUI('battleWipe', (g, k) => { g.fillStyle = '#000000'; g.fillRect(W * k, 0, W * (1 - k), H); });
defineThemeUI('standoffWind', () => {});
defineThemeFx('default', (g, f, k) => {
  const w = f.who || f.at, x = f.x != null ? f.x : f.x0 != null ? f.x0 : w && w.x != null ? w.x : W / 2, y = f.y != null ? f.y : f.y0 != null ? f.y0 : w && w.y != null ? w.y - 30 : H / 2;
  g.globalAlpha = Math.max(0, 1 - (k || 0)); g.strokeStyle = typeof f.col === 'string' ? f.col : UI.sealHi; g.lineWidth = 2;
  g.beginPath(); g.arc(x, y, 6 + 18 * (k || 0), 0, 6.283); g.stroke(); g.globalAlpha = 1;
});
// the effects the battle draws every frame (the cut, its drops...) get the same flat shape
for (const t of ['ink', 'drop', 'burst', 'glint', 'fire', 'heal']) defineThemeFx(t, (g, f, impact) => { if (!impact) THEME_FX.default(g, f, f.t / (f.life || 30)); }, { raw: true });
defineThemeUI('loading', (glyphs, text) => { X.fillStyle = '#000000'; X.fillRect(0, 0, W * S, H * S); txt(text, 320, 180, UI.cream, 12, 'center', false); });
defineThemeUI('scrollRails', (top, bottom) => { for (const y of [top, bottom]) plainBox(28, y - 2, 584, 4, UI.ink); });
defineThemeUI('scrollRods', (x, y, w, hh) => { plainBox(x - 8, y - 4, w + 16, 4, UI.ink); plainBox(x - 8, y + hh - 1, w + 16, 4, UI.ink); });
// the rhythm lane (job fw-F5a): a flat disc per note, a flat ring where the beat is judged
defineThemeUI('rhythmNote', (key, x, y, r, a = 1) => {
  X.save(); X.globalAlpha = a; X.fillStyle = key === 'a' ? UI.seal : UI.ink; X.beginPath(); X.arc(x * S, y * S, r * S, 0, 7); X.fill();
  X.fillStyle = UI.cream; X.font = `700 ${Math.round(r * S)}px ${FONT}`; X.textAlign = 'center'; X.textBaseline = 'middle';
  X.fillText(key === 'a' ? keyName('a') : { up: '↑', right: '→', down: '↓', left: '←' }[key] || '', x * S, y * S); X.restore(); X.textAlign = 'left'; X.textBaseline = 'top';
});
defineThemeUI('rhythmRing', (x, y, glow, res) => {
  X.save(); if (glow > 0) { X.globalAlpha = glow * 0.8; X.fillStyle = UI.sealHi; X.beginPath(); X.arc(x * S, y * S, 15 * S, 0, 7); X.fill(); X.globalAlpha = 1; }
  X.strokeStyle = UI.seal; X.lineWidth = 2 * S; X.beginPath(); X.arc(x * S, y * S, 15 * S, 0, 7); X.stroke(); X.restore();
});
