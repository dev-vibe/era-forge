import os
# Slice an app-made 3x3 walking sheet (magenta key) into the game sheet, like make_hayato.py but with auto-detected cells.
# usage: python3 tools/make_char.py [--game <id>] <name> <figure height in 2x art px> [soft] [q2]     e.g.  python3 tools/make_char.py magobei_33 92 q2   ('soft' for lavender/mauve cloth, see SOFT; 'q2' = hi-res cells, 2x the pixels)
# Optional 'fit' uniformly caps sheet scale to keep tall props inside the existing cells.
# Rows: front(dir0), back(dir1), left profile(dir2). Columns: stand(fr0), stride A(fr1), stride B(fr3).
# One global scale per sheet, set by the head-to-feet height of the standing FRONT figure (props such as a spear are not counted),
# so a character's rows stay in proportion. Feet sit on each cell's bottom edge, body mass centred. Cell 84x100 like Hayato's.
import sys, re, numpy as np
from PIL import Image
from scipy import ndimage as ndi
import gamepaths; GAME = gamepaths.use_game()   # job fw-F5a: `--game <id>` reads that game's assets/raw and writes its assets/game (default: the current game)
name, FIG_H = sys.argv[1], float(sys.argv[2])
SOFT = 'soft' in sys.argv[3:]   # optional 3rd arg for cloth close to the key colour (lavender, mauve): tighter magenta test, key-spill cleanup only at the silhouette edge
SRC = f'assets/raw/char_{name}.png'
if not os.path.exists(SRC): SRC = f'assets/raw/char_{name}.webp'   # vault copies are lossless webp
OUT = f'assets/game/char_{name}.png'
Q = next((int(a[1:]) for a in sys.argv[3:] if re.fullmatch(r'q[1-4]', a)), 1)   # 'q2': a hi-res sheet, cells of 84Q x 100Q (the engine draws it at the same logical size, see sheetQ in 01d_cast.js)
CW, CH = 84 * Q, 100 * Q
im = np.array(Image.open(SRC).convert('RGB')).astype(np.float32)
H, W, _ = im.shape
d = np.abs(im - np.array([250, 0, 250], np.float32)).sum(2)
mag = (im[..., 0] > 140) & (im[..., 2] > 140) & (im[..., 1] < (90 if SOFT else 130)) & (np.abs(im[..., 0] - im[..., 2]) < 60)
fg = (d > 110) & ~mag
fg = ndi.binary_opening(fg, iterations=1)
def runs(v, gap):
    idx = np.where(v)[0]; out = []; s = p = None
    for i in idx:
        if s is None: s = p = i
        elif i - p > gap: out.append((s, p + 1)); s = p = i
        else: p = i
    if s is not None: out.append((s, p + 1))
    return out
rows = runs(fg.sum(1) > 2, 14)
assert len(rows) == 3, ('row bands', rows)
cols = []
for (y0, y1) in rows:
    cs = runs(fg[y0:y1].sum(0) > 1, 60)
    assert len(cs) == 3, ('col bands', (y0, y1), cs)
    cols.append(cs)
# body height of the standing front figure: first row whose mask is wider than a prop pole, down to the feet
(y0, y1), (x0, x1) = rows[0], cols[0][0]
wid = fg[y0:y1, x0:x1].sum(1); top = y0 + int(np.argmax(wid > 25))
scale = FIG_H * Q / float(y1 - top)
if 'fit' in sys.argv[3:]:
    # Fit tall props with the same uniform scale as the body; never clip spear tips.
    scale = min(scale, (CH - 2) / max(b - a for a, b in rows),
                (CW - 2) / max(b - a for row in cols for a, b in row))
print('rows', rows, 'cols', cols, 'body px', y1 - top, 'scale', round(scale, 4))
def render_cell(im, fg, box, scale):
    """cut one figure out of the source, scale it, return (CWxCH cell, mass_x placement done)"""
    s = im[box[1]:box[3], box[0]:box[2]].copy()
    a = fg[box[1]:box[3], box[0]:box[2]].astype(np.uint8) * 255
    l2, n2 = ndi.label(ndi.binary_dilation(a > 0, iterations=5))
    if n2 > 1:
        sizes = ndi.sum(a > 0, l2, range(1, n2 + 1)); a = np.where(l2 == 1 + int(np.argmax(sizes)), a, 0).astype(np.uint8)
    spill = (s[..., 0] > 120) & (s[..., 2] > 120) & (s[..., 1] < s[..., 0] * 0.55) & (np.abs(s[..., 0] - s[..., 2]) < 70)
    a[spill & (s[..., 1] < 90)] = 0
    ys, xs = np.where(a > 0); mass_x = float(np.median(xs)); bottom = ys.max() + 1
    pm = np.dstack([s, a]).astype(np.float32); pm[..., :3] *= pm[..., 3:4] / 255
    t = Image.fromarray(pm.astype(np.uint8), 'RGBA').resize((max(1, round(pm.shape[1] * scale)), max(1, round(pm.shape[0] * scale))), Image.BOX)
    ta = np.array(t).astype(np.float32); al = ta[..., 3:4]
    rgb = np.where(al > 0, ta[..., :3] * 255 / np.maximum(al, 1), 0).clip(0, 255)
    res = Image.fromarray(np.dstack([rgb, np.where(al >= 110, 255, 0)]).astype(np.uint8), 'RGBA')
    px = round(CW / 2 - mass_x * scale); py = round(CH - bottom * scale)
    cell = Image.new('RGBA', (CW, CH), (0, 0, 0, 0)); cell.paste(res, (px, py), res)
    return cell
out = Image.new('RGBA', (CW * 3, CH * 3), (0, 0, 0, 0)); report = []
for r, (y0, y1) in enumerate(rows):
    for c, (x0, x1) in enumerate(cols[r]):
        pad = 6
        box = (max(x0 - pad, 0), max(y0 - pad, 0), min(x1 + pad, W), min(y1 + pad, H))
        cell = render_cell(im, fg, box, scale)
        out.paste(cell, (c * CW, r * CH))
        ca = np.array(cell)[..., 3] > 0; yy, xx = np.where(ca); report.append((r, c, int(xx.min()), int(xx.max()), int(yy.min()), int(yy.max())))
# optional replacement profile row: assets/raw/char_<name>_profile.png = three left-facing cells side by side on magenta (a wide strip).
# Scaled so its standing cell is as tall as the sheet's own standing profile cell, then the same scale is used for both strides.
import os
PROF = f'assets/raw/char_{name}_profile.png'
if not os.path.exists(PROF) and os.path.exists(PROF[:-4]+'.webp'): PROF = PROF[:-4]+'.webp'
if os.path.exists(PROF):
    pim = np.array(Image.open(PROF).convert('RGB')).astype(np.float32); PH, PW, _ = pim.shape
    pd_ = np.abs(pim - np.array([250, 0, 250], np.float32)).sum(2)
    pmag = (pim[..., 0] > 140) & (pim[..., 2] > 140) & (pim[..., 1] < 130) & (np.abs(pim[..., 0] - pim[..., 2]) < 60)
    pfg = ndi.binary_opening((pd_ > 110) & ~pmag, iterations=1)
    prow = runs(pfg.sum(1) > 2, 14); assert len(prow) == 1, ('profile strip rows', prow)
    pcols = runs(pfg.sum(0) > 1, 60); assert len(pcols) == 3, ('profile strip cols', pcols)
    y0, y1 = prow[0]; x0, x1 = pcols[0]
    sy = np.where(pfg[:, x0:x1].any(1))[0]; sy0, sy1 = int(sy.min()), int(sy.max()) + 1   # the standing cell's own vertical extent
    old = [rep for rep in report if rep[0] == 2 and rep[1] == 0][0]
    target_h = old[5] - old[4] + 1                      # standing profile cell height in game px, from the sheet itself
    pscale = target_h / float(sy1 - sy0)                    # includes the hairpin/props: same measure as `old`
    print('profile strip', prow, pcols, 'scale', round(pscale, 4), 'target h', target_h)
    report = [rep for rep in report if rep[0] != 2]
    for c, (cx0, cx1) in enumerate(pcols):
        pad = 6
        box = (max(cx0 - pad, 0), max(y0 - pad, 0), min(cx1 + pad, PW), min(y1 + pad, PH))
        cell = render_cell(pim, pfg, box, pscale)
        out.paste(cell, (c * CW, 2 * CH))
        ca = np.array(cell)[..., 3] > 0; yy, xx = np.where(ca); report.append((2, c, int(xx.min()), int(xx.max()), int(yy.min()), int(yy.max())))
a = np.array(out).astype(np.int32)
for _ in range(3):
    r_, g_, b_, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    tint = (al > 0) & (r_ > 105) & (b_ > 105) & (r_ - g_ > 35) & (b_ - g_ > 35) & (np.abs(r_ - b_) < 70)
    if SOFT: tint &= ndi.binary_dilation(al == 0, iterations=3)
    if not tint.any(): break
    good = (al > 0) & ~tint; k = np.ones((5, 5)); w = ndi.convolve(good.astype(float), k, mode='constant')
    for ch in range(3):
        sm = ndi.convolve(np.where(good, a[..., ch], 0).astype(float), k, mode='constant')
        a[..., ch] = np.where(tint & (w > 0), sm / np.maximum(w, 1), a[..., ch])
    a[..., 3] = np.where(tint & (w == 0), 0, a[..., 3])
a = np.array(Image.fromarray(a.astype(np.uint8), 'RGBA')); al = a[..., 3]
q = Image.fromarray(a[..., :3]).quantize(96 if Q == 1 else 160, method=Image.Quantize.FASTOCTREE, kmeans=2, dither=Image.Dither.NONE).convert('RGB')
a[..., :3] = np.array(q); a[al == 0, :3] = 0
Image.fromarray(a, 'RGBA').save(OUT)
for r in report: print(r)
print('saved', OUT)
