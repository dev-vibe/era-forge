# Job 8g-r1: slice an app-made sitting / sleeping sheet into the game sheet assets/game/sit_<cast>.png (05h_bonds.js sitSprite).
# usage: python3 tools/make_sit.py <cast> [q2] [soft]      e.g.  python3 tools/make_sit.py magobei_33 q2
# Source: assets/raw/sit_<cast>.png (Ash's app original, flat magenta #FF00FF), laid out as the prompts ask:
#   top row, three figures: standing facing the camera (the SIZE reference only), sitting facing the camera, sitting in profile facing left;
#   bottom row (companions only): one figure asleep on a straw mat.
# Scale: the standing figure is scaled to the same body height as the standing front cell of the character's walking sheet
# (assets/game/char_<cast>.png), so sitting and walking sprites match. Body height = from the first row wider than 30% of the
# figure's widest row (skips a topknot, a spear tip) down to the feet, measured the same way on both.
# Output: 3 x 84Q wide; row 0 = three 84Q x 100Q cells (stand, sit front, sit left), row 1 = one 252Q x 100Q cell (asleep), or
# one row only when there is no sleeping figure. Figures stand on each cell's bottom edge, centred.
import os, re, sys, numpy as np
from PIL import Image
from scipy import ndimage as ndi
cast = sys.argv[1]
Q = next((int(a[1:]) for a in sys.argv[2:] if re.fullmatch(r'q[1-4]', a)), 2)
SOFT = 'soft' in sys.argv[2:]
SRC = f'assets/raw/sit_{cast}.png'
if not os.path.exists(SRC): SRC = SRC[:-4] + '.webp'
OUT = f'assets/game/sit_{cast}.png'
CW, CH = 84 * Q, 100 * Q
im = np.array(Image.open(SRC).convert('RGB')).astype(np.float32); H, W, _ = im.shape
d = np.abs(im - np.array([250, 0, 250], np.float32)).sum(2)
mag = (im[..., 0] > 140) & (im[..., 2] > 140) & (im[..., 1] < (90 if SOFT else 130)) & (np.abs(im[..., 0] - im[..., 2]) < 60)
fg = ndi.binary_opening((d > 110) & ~mag, iterations=1)
def runs(v, gap):
    idx = np.where(v)[0]; out = []; s = p = None
    for i in idx:
        if s is None: s = p = i
        elif i - p > gap: out.append((s, p + 1)); s = p = i
        else: p = i
    if s is not None: out.append((s, p + 1))
    return [r for r in out if r[1] - r[0] > 12]
def body_h(mask):
    """height from the first row wider than 30% of the widest row down to the lowest opaque row"""
    wid = mask.sum(1); ys = np.where(wid > 0)[0]
    return ys.max() + 1 - int(np.argmax(wid > 0.3 * wid.max()))
rows = runs(fg.sum(1) > 2, 14)
assert len(rows) in (1, 2), ('row bands', rows)
cols = runs(fg[rows[0][0]:rows[0][1]].sum(0) > 1, 40)
assert len(cols) == 3, ('top row figures', cols)
# the size reference: the walking sheet's standing front cell
ref = np.array(Image.open(f'assets/game/char_{cast}.png').convert('RGBA'))
rq = max(1, round(ref.shape[1] / 252)); rcell = ref[:100 * rq, :84 * rq, 3] > 0
target = body_h(rcell) * Q / rq
(y0, y1), (x0, x1) = rows[0], cols[0]
scale = target / float(body_h(fg[y0:y1, x0:x1]))
print('rows', rows, 'cols', cols, 'target body', round(target, 1), 'scale', round(scale, 4))
def render(box, cw, ch, centre='median'):
    s = im[box[1]:box[3], box[0]:box[2]].copy(); a = fg[box[1]:box[3], box[0]:box[2]].astype(np.uint8) * 255
    l2, n2 = ndi.label(ndi.binary_dilation(a > 0, iterations=5))
    if n2 > 1:
        sizes = ndi.sum(a > 0, l2, range(1, n2 + 1)); a = np.where(l2 == 1 + int(np.argmax(sizes)), a, 0).astype(np.uint8)
    spill = (s[..., 0] > 120) & (s[..., 2] > 120) & (s[..., 1] < s[..., 0] * 0.55) & (np.abs(s[..., 0] - s[..., 2]) < 70)
    a[spill & (s[..., 1] < 90)] = 0
    ys, xs = np.where(a > 0); cx = float(np.median(xs)) if centre == 'median' else (xs.min() + xs.max()) / 2; bottom = ys.max() + 1
    pm = np.dstack([s, a]).astype(np.float32); pm[..., :3] *= pm[..., 3:4] / 255
    t = Image.fromarray(pm.astype(np.uint8), 'RGBA').resize((max(1, round(pm.shape[1] * scale)), max(1, round(pm.shape[0] * scale))), Image.BOX)
    ta = np.array(t).astype(np.float32); al = ta[..., 3:4]
    rgb = np.where(al > 0, ta[..., :3] * 255 / np.maximum(al, 1), 0).clip(0, 255)
    res = Image.fromarray(np.dstack([rgb, np.where(al >= 110, 255, 0)]).astype(np.uint8), 'RGBA')
    cell = Image.new('RGBA', (cw, ch), (0, 0, 0, 0)); cell.paste(res, (round(cw / 2 - cx * scale), round(ch - bottom * scale)), res)
    bb = cell.getbbox(); assert bb and bb[0] > 0 and bb[2] < cw and bb[1] > 0, ('figure does not fit its cell', bb, (cw, ch))
    return cell
out = Image.new('RGBA', (CW * 3, CH * len(rows)), (0, 0, 0, 0)); pad = 6
for c, (cx0, cx1) in enumerate(cols):
    out.paste(render((max(cx0 - pad, 0), max(rows[0][0] - pad, 0), min(cx1 + pad, W), min(rows[0][1] + pad, H)), CW, CH), (c * CW, 0))
if len(rows) == 2:
    (sy0, sy1) = rows[1]; sc = runs(fg[sy0:sy1].sum(0) > 1, 80); assert len(sc) == 1, ('sleeping row: one figure on a mat', sc)
    out.paste(render((max(sc[0][0] - pad, 0), max(sy0 - pad, 0), min(sc[0][1] + pad, W), min(sy1 + pad, H)), CW * 3, CH, 'box'), (0, CH))
# magenta fringe left inside the silhouette (as make_char.py): blend those pixels from their clean neighbours
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
a = a.astype(np.uint8); al = a[..., 3]
q = Image.fromarray(a[..., :3]).quantize(160, method=Image.Quantize.FASTOCTREE, kmeans=2, dither=Image.Dither.NONE).convert('RGB')
a[..., :3] = np.array(q); a[al == 0, :3] = 0
Image.fromarray(a, 'RGBA').save(OUT); print('saved', OUT, out.size)
